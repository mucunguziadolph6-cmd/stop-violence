import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SITE_CONTACT } from "@/lib/site-contact";
import bgAsset from "@/assets/stop-violence-choose-peace.png.asset.json";

export const Route = createFileRoute("/about")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "About — Stop Violence, Choose Peace" },
      {
        name: "description",
        content:
          "How Stop Violence works: report a problem with a description, location and photo, keep your name private, and let your school respond.",
      },
      { property: "og:title", content: "About Stop Violence — Choose Peace" },
      {
        property: "og:description",
        content:
          "Report a problem privately, get help from your school, and reach the Rwanda Investigation Bureau in an emergency.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

function About() {
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
        <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight">About this site</h1>
          <p className="mt-3 text-sm leading-relaxed">
            Stop Violence gives students, staff and residents one simple way to report a problem: write what happened,
            add where it happened, and attach a photo if you have one. You can speak your report instead of typing it,
            and the site can suggest a category and a short summary for you to check before sending.
          </p>
          <h2 className="mt-6 text-lg font-semibold">Your privacy comes first</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">
            <li>Your name is kept on your own account. It is never shown on a report other people can read.</li>
            <li>Photos you attach stay private to you — they are not published with the report.</li>
            <li>Reports you send while signed out are saved only on the device you are using.</li>
          </ul>
          <h2 className="mt-6 text-lg font-semibold">Who can help</h2>
          <p className="mt-2 text-sm leading-relaxed">
            When you create an account you say whether you are a Student or a School Administrator (Director of
            Studies, Head Teacher or Discipline Master), then choose your school. Administrators are approved before
            they can see anything. When a student reports a problem, the approved administrators at that school are
            alerted straight away and can write advice back — only that student sees the reply.
          </p>
          <h2 className="mt-6 text-lg font-semibold">In an emergency</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Do not wait for a reply here. Call the Rwanda Investigation Bureau on <strong>166</strong> or visit{" "}
            <a className="underline" href="https://www.rib.gov.rw/" target="_blank" rel="noreferrer">
              rib.gov.rw
            </a>
            .
          </p>
          <h2 className="mt-6 text-lg font-semibold">About us</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Stop Violence is run by the site owner, who reads every message that comes in. For questions, help with a
            report, or to work with us, reach us directly:
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <span className="text-muted-foreground">Email: </span>
              <a className="font-medium underline" href={`mailto:${SITE_CONTACT.email}`}>
                {SITE_CONTACT.email}
              </a>
            </li>
            {SITE_CONTACT.phones.map((phone) => (
              <li key={phone.tel}>
                <span className="text-muted-foreground">Phone: </span>
                <a className="font-medium underline" href={phone.tel}>
                  {phone.display}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/">Report a problem</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/contact">Contact</Link>
            </Button>
          </div>
        </div>
      </main>
      <footer className="relative mx-auto max-w-xl px-4 pb-10 text-center">
        <span className="inline-block rounded-lg bg-card/90 px-3 py-2 text-sm text-muted-foreground">
          <Link to="/" className="underline">
            Home
          </Link>
          {" · "}
          <Link to="/contact" className="underline">
            Contact
          </Link>
        </span>
      </footer>
    </>
  );
}
