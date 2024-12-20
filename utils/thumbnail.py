from io import BytesIO
from PIL import Image, ImageDraw
import os
from utils.clients import get_client
from config import STORAGE_CHANNEL
import asyncio
import logging
from pyrogram.types import Message
import aiohttp
import tempfile

logger = logging.getLogger(__name__)

async def generate_thumbnail(file):
    client = get_client()
    message = await client.get_messages(STORAGE_CHANNEL, file.file_id)
    
    if not message.document and not message.video and not message.photo:
        raise Exception("Unsupported file type")

    try:
        if message.document and message.document.mime_type.startswith('image/'):
            # For images, download and process
            file_path = await message.download()
            try:
                with Image.open(file_path) as img:
                    max_size = (400, 400)
                    img.thumbnail(max_size, Image.Resampling.LANCZOS)
                    thumb = Image.new('RGB', max_size, (248, 249, 250))
                    offset = ((max_size[0] - img.size[0]) // 2,
                             (max_size[1] - img.size[1]) // 2)
                    thumb.paste(img, offset)
                    output = BytesIO()
                    thumb.save(output, format='JPEG', quality=85)
                    return output.getvalue()
            finally:
                try:
                    os.remove(file_path)
                except:
                    pass
                
        elif message.video:
            try:
                # If Telegram thumbnail is available, use it
                if message.video.thumbs:
                    thumb_file = await client.download_media(message.video.thumbs[0].file_id)
                    try:
                        with Image.open(thumb_file) as img:
                            max_size = (400, 400)
                            img.thumbnail(max_size, Image.Resampling.LANCZOS)
                            thumb = Image.new('RGB', max_size, (248, 249, 250))
                            offset = ((max_size[0] - img.size[0]) // 2,
                                     (max_size[1] - img.size[1]) // 2)
                            thumb.paste(img, offset)
                            output = BytesIO()
                            thumb.save(output, format='JPEG', quality=85)
                            return output.getvalue()
                    finally:
                        try:
                            os.remove(thumb_file)
                        except:
                            pass

                # If no Telegram thumbnail, stream first few MB and extract frame
                with tempfile.NamedTemporaryFile(suffix='.mp4', delete=False) as temp_file:
                    temp_path = temp_file.name
                
                # Stream only first 5MB of video
                async with client.stream_media(message, limit=5*1024*1024) as stream:
                    with open(temp_path, 'wb') as f:
                        async for chunk in stream:
                            f.write(chunk)
                
                try:
                    # Extract frame from the beginning of video
                    process = await asyncio.create_subprocess_exec(
                        'ffmpeg', '-ss', '0', '-i', temp_path,
                        '-vf', 'scale=400:400:force_original_aspect_ratio=decrease',
                        '-vframes', '1', '-f', 'image2', '-c:v', 'mjpeg', 'pipe:1',
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, stderr = await process.communicate()
                    
                    if process.returncode == 0:
                        return stdout
                    raise Exception("Failed to generate video thumbnail")
                
                finally:
                    try:
                        os.remove(temp_path)
                    except:
                        pass

            except Exception as e:
                logger.error(f"Error generating video thumbnail: {e}")
                # Create default video thumbnail
                img = Image.new('RGB', (400, 400), (248, 249, 250))
                draw = ImageDraw.Draw(img)
                draw.text((200, 200), "Video", fill=(128, 128, 128), anchor="mm")
                output = BytesIO()
                img.save(output, format='JPEG', quality=85)
                return output.getvalue()

    except Exception as e:
        logger.error(f"Thumbnail generation failed: {e}")
        # Return a generic thumbnail for any errors
        img = Image.new('RGB', (400, 400), (248, 249, 250))
        draw = ImageDraw.Draw(img)
        draw.text((200, 200), "Preview\nNot Available", fill=(128, 128, 128), anchor="mm", align="center")
        output = BytesIO()
        img.save(output, format='JPEG', quality=85)
        return output.getvalue()