export default function AuthShell({ title, description, children, footer }) {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="overflow-hidden rounded-[2rem] bg-slate-950 p-8 text-white shadow-2xl shadow-slate-900/20 lg:p-10">
          <p className="text-xs uppercase tracking-[0.32em] text-emerald-200/80">SITWallet</p>
          <h1 className="mt-6 max-w-md font-display text-4xl leading-tight text-white sm:text-5xl">
            Secure your financial future with SITWallet.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-slate-300 sm:text-base">{description}</p>
          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Multi-currency</p>
              <p className="mt-2 text-lg font-semibold text-white">Hold, swap, and send across global currencies.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-400">Security</p>
              <p className="mt-2 text-lg font-semibold text-white">MFA, CSRF protection, and secure session handling.</p>
            </div>
          </div>
        </section>

        <section className="flex flex-col justify-center rounded-[2rem] border border-[#ddd3bc] bg-white/85 p-6 shadow-xl shadow-slate-900/5 backdrop-blur sm:p-8 lg:p-10">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{title}</p>
            <h2 className="mt-3 font-display text-3xl text-slate-950">{title}</h2>
          </div>
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-6 text-sm text-slate-500">{footer}</div> : null}
        </section>
      </div>
    </div>
  )
}