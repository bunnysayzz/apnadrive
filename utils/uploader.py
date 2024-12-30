from utils.clients import get_client
from pyrogram import Client
from pyrogram.types import Message
from config import STORAGE_CHANNEL
import os
from utils.logger import Logger
from urllib.parse import unquote_plus
import subprocess
import asyncio
from pathlib import Path

logger = Logger(__name__)
PROGRESS_CACHE = {}
STOP_TRANSMISSION = []

async def compress_video(input_path: str) -> str:
    """Compress video to reduce size while maintaining quality"""
    try:
        output_path = str(Path(input_path).with_suffix('.compressed.mp4'))
        
        # Compress video using ffmpeg
        process = await asyncio.create_subprocess_exec(
            'ffmpeg', '-i', input_path,
            '-c:v', 'libx264', '-preset', 'medium',
            '-crf', '28',  # Adjust CRF for quality vs. size trade-off
            '-c:a', 'aac', '-b:a', '128k',
            output_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        await process.communicate()
        
        if process.returncode == 0:
            return output_path
        else:
            logger.error(f"Failed to compress video {input_path}")
            return input_path
            
    except Exception as e:
        logger.error(f"Error compressing video: {e}")
        return input_path

async def progress_callback(current, total, id, client: Client, file_path):
    global PROGRESS_CACHE, STOP_TRANSMISSION

    PROGRESS_CACHE[id] = ("running", current, total)
    if id in STOP_TRANSMISSION:
        logger.info(f"Stopping transmission {id}")
        client.stop_transmission()
        try:
            os.remove(file_path)
        except:
            pass

async def start_file_uploader(file_path, id, directory_path, filename, file_size):
    global PROGRESS_CACHE
    from utils.directoryHandler import DRIVE_DATA

    logger.info(f"Uploading file {file_path} {id}")

    try:
        # Always compress videos
        ext = Path(file_path).suffix.lower()
        video_extensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm']
        original_path = file_path

        if ext in video_extensions:
            logger.info(f"Compressing video {file_path}")
            PROGRESS_CACHE[id] = ("compressing", 0, file_size)
            compressed_path = await compress_video(file_path)
            
            # Update file_path and file_size after compression
            file_path = compressed_path
            file_size = os.path.getsize(file_path)
            
            # Delete original file after compression
            try:
                os.remove(original_path)
            except Exception as e:
                logger.error(f"Failed to remove original file: {e}")

        if file_size > 1.98 * 1024 * 1024 * 1024:
            # Use premium client for files larger than 2 GB
            client: Client = get_client(premium_required=True)
        else:
            client: Client = get_client()

        PROGRESS_CACHE[id] = ("running", 0, 0)

        message: Message = await client.send_document(
            STORAGE_CHANNEL,
            file_path,
            progress=progress_callback,
            progress_args=(id, client, file_path),
            disable_notification=True,
        )

        size = (
            message.photo
            or message.document
            or message.video
            or message.audio
            or message.sticker
        ).file_size

        filename = unquote_plus(filename)

        DRIVE_DATA.new_file(directory_path, filename, message.id, size)
        PROGRESS_CACHE[id] = ("completed", size, size)
        logger.info(f"Uploaded file {file_path} {id}")

    except Exception as e:
        logger.error(f"Failed to upload file {file_path} {id}: {e}")
        PROGRESS_CACHE[id] = ("error", 0, 0)

    finally:
        # Ensure all related files are cleaned up
        try:
            if os.path.exists(file_path):
                os.remove(file_path)
            if 'compressed_path' in locals() and os.path.exists(compressed_path):
                os.remove(compressed_path)
            if os.path.exists(original_path):
                os.remove(original_path)
        except Exception as e:
            logger.error(f"Failed to cleanup files: {e}")
