import { authTokenFromCredentials } from "@/utils/server"

export async function terminalConnectToken(input: {
  url: string
  id: string
  directory: string
  auth?: { username?: string; password?: string }
  fetch?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>
}) {
  const url = new URL(`${input.url}/api/pty/${input.id}/connect-token`)
  url.searchParams.set("location[directory]", input.directory)

  const headers: Record<string, string> = { "x-opencode-ticket": "1" }
  if (input.auth?.password)
    headers.authorization = `Basic ${authTokenFromCredentials({
      username: input.auth.username,
      password: input.auth.password,
    })}`

  // TODO: Luke should check this for stupidity once special PTY endpoints have generated client support.
  const response = await (input.fetch ?? fetch)(url, {
    method: "POST",
    headers,
  })
  if (!response.ok) return { status: response.status }

  const result = (await response.json()) as { data?: { ticket?: string } }
  return { status: response.status, ticket: result.data?.ticket }
}
