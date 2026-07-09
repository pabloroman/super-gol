export function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-6">
      <h1 className="font-display text-3xl font-extrabold uppercase text-grass-400">
        Super Gol
      </h1>
      <p className="text-slate-300">Falta conectar Supabase para arrancar.</p>
      <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-400">
        <li>
          Crea un proyecto en{' '}
          <span className="text-slate-200">supabase.com</span>.
        </li>
        <li>
          Copia <code className="rounded bg-black/40 px-1">.env.example</code> a{' '}
          <code className="rounded bg-black/40 px-1">.env</code> y rellena la URL
          y la anon key.
        </li>
        <li>
          Aplica el esquema:{' '}
          <code className="rounded bg-black/40 px-1">supabase db reset</code>{' '}
          (o pega las migraciones en el SQL editor).
        </li>
        <li>Reinicia el servidor de desarrollo.</li>
      </ol>
    </div>
  )
}
