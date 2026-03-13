


export function createPageUrl(pageName: string) {
  // Use the page name directly so it matches keys in pages.config (e.g. "ProjectsList")
  return '/' + pageName.replace(/ /g, '');
}