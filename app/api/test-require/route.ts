import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const info: Record<string, any> = {
    cwd: process.cwd(),
    taskFiles: [],
    nodeModulesFiles: [],
    nodePath: process.env.NODE_PATH || null,
  };

  try {
    info.taskFiles = fs.readdirSync('/var/task');
  } catch (e: any) {
    info.taskFilesError = e.message;
  }

  try {
    info.nodeModulesFiles = fs.readdirSync('/var/task/node_modules');
  } catch (e: any) {
    info.nodeModulesError = e.message;
  }

  // Check if .next/server exists
  try {
    info.nextServerFiles = fs.readdirSync('/var/task/.next/server');
  } catch (e: any) {
    info.nextServerError = e.message;
  }

  // Check if pg can be found via relative path
  const candidatePaths = [
    '/var/task/node_modules/pg',
    '/var/task/node_modules/.pnpm',
    '/var/task/.netlify/functions-internal/___netlify-server-handler/node_modules/pg',
  ];

  const existence: Record<string, boolean> = {};
  for (const p of candidatePaths) {
    try {
      existence[p] = fs.existsSync(p);
      if (fs.existsSync(p)) {
        const stat = fs.lstatSync(p);
        existence[p + ' (isSymbolicLink)'] = stat.isSymbolicLink();
        if (stat.isSymbolicLink()) {
          existence[p + ' (readlink)'] = fs.readlinkSync(p);
        }
      }
    } catch (e: any) {
      existence[p + ' (error)'] = e.message;
    }
  }
  info.existence = existence;

  return NextResponse.json(info);
}
