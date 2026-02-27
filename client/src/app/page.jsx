import SmartCanvas from './_components/smartCanvas';
import { ReactFlowProvider } from '@xyflow/react';

export default function Home() {
  return (
    <main className="w-full h-screen">
      <ReactFlowProvider>
        <SmartCanvas />
      </ReactFlowProvider>
    </main>
  );
}