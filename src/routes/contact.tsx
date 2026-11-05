import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { RIB_CONTACT } from "@/lib/emergency-contacts";
import bgAsset from "@/assets/stop-violence-choose-peace.png.asset.json";

export const Route = createFileRoute("/contact")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Contact — Stop Violence, Choose Peace" },
      {
        name: "description",
        content:
          "How to reach help: call RIB on 166 in an emergency, report a problem through the site, or get support from your school.",
      },
      { property: "og:title", content: "Contact Stop Violence — Choose Peace" },
      {
        property: "og:description",
        content: "Emergency help on 166, problem reports through the site, and school follow-up in your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Contact,
});

function Contact() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgAsset.url})` }}
      />
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-background/85" />
      <main className="relative mx-auto max-w-xl px-4 py-10">
        <header className="text-center">
          <p className="text-3xl font-black uppercase tracking-tight text-destructive sm:text-4xl">Stop Violence</p>
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-foreground">Choose Peace</p>
        </header>
        <h1 className="mt-6 text-2xl font-bold tracking-tight">Get in touch</h1>
        <section className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <h2 className="text-base font-semibold text-destructive">If you are in danger right now</h2>
          <p className="mt-1 text-sm">Call the Rwanda Investigation Bureau — the line is free and open all day.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild variant="destructive">
              <a href={RIB_CONTACT.callUrl}>Call {RIB_CONTACT.emergencyNumber}</a>
            </Button>
            <Button asChild variant="outline">
              <a href={RIB_CONTACT.websiteUrl} target="_blank" rel="noreferrer">
                Official RIB website
              </a>
            </Button>
          </div>
        </section>
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Report a problem</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Use the report form on the home page: describe what happened, add the location, and attach a photo if you
            have one. Sign in first and your report is saved to your account and shared with the people who can act.
          </p>
          <Button asChild className="mt-3">
            <Link to="/">Open the report form</Link>
          </Button>
        </section>
        <section className="mt-6">
          <h2 className="text-lg font-semibold">School follow-up</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Students' reports reach the approved administrators at their school — the Director of Studies, Head Teacher
            or Discipline Master. Their reply appears in your account under "Replies from school". Other students never
            see it.
          </p>
        </section>
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Account help</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Forgotten your password? Open the sign-in page and choose "Forgot password?" to receive a reset link.
          </p>
          <Button asChild variant="outline" className="mt-3">
            <Link to="/auth">Sign in</Link>
          </Button>
        </section>
      </main>
      <footer className="relative mx-auto max-w-xl px-4 pb-10 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline">
          Home
        </Link>
        {" · "}
        <Link to="/about" className="underline">
          About
        </Link>
      </footer>
    </>
  );
}
