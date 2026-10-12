import { NextResponse } from 'next/server';
import dns from 'dns';
import net from 'net';
import tls from 'tls';

export const dynamic = 'force-dynamic';

export async function GET() {
  const steps: Record<string, any> = {};

  try {
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl) {
      return NextResponse.json({ success: false, error: 'DATABASE_URL is not set' });
    }

    let host = '';
    let port = 5432;
    let user = '';
    let database = '';

    try {
      const u = new URL(dbUrl);
      host = u.hostname;
      port = parseInt(u.port || '5432', 10);
      user = u.username;
      database = u.pathname.replace(/^\//, '');
    } catch (e: any) {
      return NextResponse.json({ success: false, error: 'Failed to parse DATABASE_URL: ' + e.message });
    }

    steps.config = {
      host,
      port,
      user,
      database,
      urlLength: dbUrl.length,
    };

    // Step 1: DNS Lookup
    try {
      const dnsRes = await dns.promises.lookup(host);
      steps.dns = { success: true, ip: dnsRes.address, family: dnsRes.family };
    } catch (err: any) {
      steps.dns = { success: false, error: err.message, code: err.code };
      return NextResponse.json({ success: false, steps });
    }

    // Step 2: Raw TCP Socket connect with 3s timeout
    const tcpResult = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      const socket = net.createConnection({ host, port, timeout: 3000 });
      socket.on('connect', () => {
        socket.destroy();
        resolve({ success: true });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ success: false, error: 'TCP connection timed out after 3000ms' });
      });
      socket.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
    steps.tcp = tcpResult;
    if (!tcpResult.success) {
      return NextResponse.json({ success: false, steps });
    }

    // Step 3: Raw TLS connect with 3s timeout
    const tlsResult = await new Promise<{ success: boolean; error?: string; authorized?: boolean }>((resolve) => {
      const tlsSocket = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout: 3000 });
      tlsSocket.on('secureConnect', () => {
        const authorized = tlsSocket.authorized;
        tlsSocket.destroy();
        resolve({ success: true, authorized });
      });
      tlsSocket.on('timeout', () => {
        tlsSocket.destroy();
        resolve({ success: false, error: 'TLS handshake timed out after 3000ms' });
      });
      tlsSocket.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
    });
    steps.tls = tlsResult;

    // Step 4: pg Pool query with explicit error handler
    const pg = await import('pg');
    const { Pool } = pg.default || pg;
    const pool = new Pool({
      connectionString: dbUrl,
      connectionTimeoutMillis: 3000,
      ssl: { rejectUnauthorized: false },
    });
    pool.on('error', (err) => {
      steps.poolBackgroundError = err.message;
    });

    try {
      const queryRes = await pool.query('SELECT 1 as ok, current_database() as db_name, version() as pg_version');
      steps.pgQuery = { success: true, rows: queryRes.rows };
    } catch (err: any) {
      steps.pgQuery = { success: false, error: err.message, code: err.code };
    } finally {
      await pool.end().catch(() => {});
    }

    return NextResponse.json({
      success: steps.pgQuery?.success ?? false,
      steps,
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
      stack: err.stack,
      steps,
    });
  }
}
