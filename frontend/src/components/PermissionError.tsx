interface PermissionErrorProps {
  message?: string
}

/** Inline 403 message — distinct from the app's automatic 401-logs-you-out handling in
 * api/client.ts. A 403 means the user is logged in but their role doesn't allow this
 * action, so we show this instead of redirecting to login. */
function PermissionError({ message }: PermissionErrorProps) {
  return <p className="matter-error">{message ?? 'You do not have permission to perform this action.'}</p>
}

export default PermissionError
