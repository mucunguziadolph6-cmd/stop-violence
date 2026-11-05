<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI calls (category suggestion, voice transcription) run server-side via Lovable AI Gateway; reports live in browser localStorage until Lovable Cloud is enabled — why: Cloud setup is currently failing.
- Keep official emergency destinations in a shared client-safe contact module and open them only on explicit user action; never automatically transmit report data — why: emergency access must not imply dispatch or expose private reports.
- Every route file sets `staticData.sitemap` explicitly, and only routes with real, finished content are listed — why: sitemap.xml is generated from the router, so a missing decision breaks the build and a listed page with no content publishes a 404.
