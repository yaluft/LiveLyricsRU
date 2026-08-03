import { createResource, Show, type JSX } from 'solid-js';

interface Health {
  status: string;
  version: number;
}

async function fetchHealth(): Promise<Health> {
  const response = await fetch('/api/health');
  if (!response.ok) throw new Error(`health ${response.status}`);
  return (await response.json()) as Health;
}

export function App(): JSX.Element {
  const [health] = createResource(fetchHealth);

  return (
    <main data-testid="app">
      <h1>Лирика</h1>
      <Show when={health()} fallback={<p data-testid="health">…</p>}>
        {(value) => <p data-testid="health">api v{value().version} · {value().status}</p>}
      </Show>
    </main>
  );
}
