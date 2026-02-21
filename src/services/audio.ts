export function buildDownloadUrl(artifactUrl: string, fileName: string) {
  const link = document.createElement('a')
  link.href = artifactUrl
  link.download = fileName
  return link
}

export function copyShareText(text: string) {
  return navigator.clipboard.writeText(text)
}
