import { PrismaClient } from '@prisma/client';
import { withPulse } from '@prisma/extension-pulse';
import { Inngest } from 'inngest';

const apiKey: string = process.env.PULSE_API_KEY ?? '';
const prisma = new PrismaClient().$extends(withPulse({ apiKey: apiKey }));
const inngest = new Inngest({ id: 'my-app' });

process.on('SIGINT', () => {
  process.exit(0);
});

const MODELS = ['notification', 'user'];

async function handleStream(stream: AsyncIterable<any>, model: string) {
  console.log('Streaming events from', model);
  for await (const event of stream) {
    console.log(`Event from ${model}:`, event);

    await inngest.send({
      name: `db/${event.action}.${model}`,
      data: event,
    });
  }
}

async function main() {
  const streams: any[] = [];
  for (const model of MODELS) {
    if (!Object.keys(prisma).includes(model)) {
      console.log(`Model not found in Prisma client (${model}). Skipping...`);
      continue;
    }

    const stream = await (prisma as any)[model].stream({ name: `stream-${model}` });
    streams.push(handleStream(stream, model));

    process.on('exit', (code) => {
      console.log('Stopping stream', model);
      stream.stop();
    });
  }

  await Promise.all(streams);
}

main();
