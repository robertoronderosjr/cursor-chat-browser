import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import os from 'os';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    const { content, filename } = await request.json();

    // Create a temporary file
    const tmpDir = os.tmpdir();
    const tmpFile = join(tmpDir, filename);
    await writeFile(tmpFile, content);

    // Create gist using gh CLI
    const { stdout } = await execAsync(`gh gist create "${tmpFile}" --public`);
    
    // The gh command outputs the gist URL
    const gistUrl = stdout.trim();

    return NextResponse.json({ url: gistUrl });
  } catch (error) {
    console.error('Error creating gist:', error);
    return NextResponse.json(
      { error: 'Failed to create gist' },
      { status: 500 }
    );
  }
} 