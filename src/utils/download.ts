/** Propose un fichier texte au téléchargement (export local, aucun envoi réseau). */
export function downloadTextFile(fileName: string, content: string, mimeType = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Laisse le temps au navigateur de lancer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Nom de fichier sûr à partir d'un titre. */
export function safeFileName(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase() || 'livre'
  );
}
