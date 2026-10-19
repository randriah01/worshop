const services = [
  { nom: 'API paiement', etat: 'OK' },
  { nom: 'Base de données', etat: 'OK' },
  { nom: 'Authentification', etat: 'OK' },
  { nom: 'Frontal web', etat: 'OK' },
]

export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 p-8 text-white">
      <h1 className="mb-6 text-2xl font-bold">Resilience-Alpha : supervision</h1>
      <div className="grid grid-cols-2 gap-4">
        {services.map((s) => (
          <div key={s.nom} className="rounded-lg bg-slate-800 p-4">
            <p className="font-semibold">{s.nom}</p>
            <p className={s.etat === 'OK' ? 'text-green-400' : 'text-red-400'}>
              {s.etat}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}