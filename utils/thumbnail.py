from io import BytesIO
from PIL import Image, ImageDraw
import os
from utils.clients import get_client
from config import STORAGE_CHANNEL
import asyncio
import logging
import traceback

logger = logging.getLogger(__name__)

async def generate_thumbnail(file):
    client = get_client()
    temp_files = []  # Track temporary files
    
    try:
        logger.info(f"Generating thumbnail for file: {file.id}")
        message = await client.get_messages(STORAGE_CHANNEL, file.file_id)
        
        if not message:
            logger.error(f"Message not found for file_id: {file.file_id}")
            return create_default_thumbnail("File Not Found")

        if not message.document and not message.video and not message.photo:
            logger.error(f"Unsupported file type for file_id: {file.file_id}")
            return create_default_thumbnail("Unsupported Type")

        # For videos, first try to get Telegram's thumbnail
        if message.video and message.video.thumbs:
            try:
                logger.info("Using Telegram video thumbnail")
                thumb_file = await client.download_media(message.video.thumbs[0].file_id)
                temp_files.append(thumb_file)
                return await process_image_thumbnail(thumb_file)
            except Exception as e:
                logger.error(f"Failed to get Telegram video thumbnail: {str(e)}")

        # For images
        if message.document and message.document.mime_type.startswith('image/'):
            try:
                logger.info("Processing image file")
                file_path = await message.download()
                temp_files.append(file_path)
                return await process_image_thumbnail(file_path)
            except Exception as e:
                logger.error(f"Failed to process image: {str(e)}")
                return create_default_thumbnail("Image Error")

        # For videos without Telegram thumbnail
        if message.video:
            try:
                logger.info("Generating video thumbnail")
                temp_path = f"temp_video_{file.id}.mp4"
                temp_files.append(temp_path)
                
                try:
                    async with client.stream_media(message, limit=1024*1024) as stream:
                        with open(temp_path, 'wb') as f:
                            async for chunk in stream:
                                f.write(chunk)

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
                    
                    logger.error(f"FFmpeg error: {stderr.decode()}")
                    raise Exception("FFmpeg failed")

                finally:
                    # Cleanup is handled in the outer finally block
                    pass

            except Exception as e:
                logger.error(f"Video thumbnail generation failed: {str(e)}")
                return create_default_thumbnail("Video Preview\nNot Available")

        return create_default_thumbnail("Preview\nNot Available")

    except Exception as e:
        logger.error(f"Thumbnail generation failed: {str(e)}")
        return create_default_thumbnail("Error")
        
    finally:
        # Clean up all temporary files
        for temp_file in temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
            except Exception as e:
                logger.error(f"Failed to remove temp file {temp_file}: {e}")

async def process_image_thumbnail(file_path):
    try:
        with Image.open(file_path) as img:
            # Convert RGBA to RGB if necessary
            if img.mode in ('RGBA', 'LA'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1])
                img = background

            # Calculate dimensions maintaining aspect ratio
            max_size = (400, 400)
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Create new image with white background
            thumb = Image.new('RGB', max_size, (248, 249, 250))
            
            # Paste the resized image in the center
            offset = ((max_size[0] - img.size[0]) // 2,
                     (max_size[1] - img.size[1]) // 2)
            thumb.paste(img, offset)
            
            output = BytesIO()
            thumb.save(output, format='JPEG', quality=85)
            return output.getvalue()
    finally:
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
        except:
            pass

def create_default_thumbnail(text):
    img = Image.new('RGB', (400, 400), (248, 249, 250))
    draw = ImageDraw.Draw(img)
    draw.text((200, 200), text, fill=(128, 128, 128), anchor="mm", align="center")
    output = BytesIO()
    img.save(output, format='JPEG', quality=85)
    return output.getvalue()