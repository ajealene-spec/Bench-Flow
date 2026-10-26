/** How to turn the research package into a DOI. The user uploads the package to Zenodo themselves. */
export function ZenodoHelp() {
  return (
    <details className="no-print mx-auto mt-6 w-full max-w-3xl rounded-2xl border border-border bg-surface shadow-card p-4 text-text">
      <summary className="min-h-12 cursor-pointer py-2 text-lg font-semibold">How to get a DOI on Zenodo</summary>
      <ol className="mt-3 list-decimal space-y-3 pl-6 text-base leading-relaxed">
        <li>Download the research package (.zip) above. Nothing is uploaded by Bench Flow.</li>
        <li>
          Sign in at zenodo.org with your own account, then choose <strong>New upload</strong>.
        </li>
        <li>
          Upload the .zip as the file. Zenodo does not read .zenodo.json from a manual upload, so open that file and copy its title,
          description, creators, keywords and license into the form. metadata.json has the same fields in DataCite form if you need them.
        </li>
        <li>Check the license and access settings match the protocol license shown in the README.</li>
        <li>
          Choose <strong>Publish</strong>. Zenodo assigns a DOI. Published records and their files cannot be deleted, so review everything
          first, including photos and names.
        </li>
        <li>Add the DOI to your paper or notebook. If you copy this protocol later, record the DOI in the credit fields.</li>
      </ol>
      <p className="mt-3 text-sm text-text-muted">Zenodo is a third-party service. Bench Flow only creates the files.</p>
    </details>
  );
}
