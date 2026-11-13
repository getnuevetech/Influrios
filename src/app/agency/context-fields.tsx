export function AgencyActionContext({
  token,
  workspaceId,
  clientId,
}: {
  token: string;
  workspaceId: string;
  clientId: string;
}) {
  return (
    <>
      <input type="hidden" name="context" value={token} />
      <input type="hidden" name="workspaceId" value={workspaceId} />
      <input type="hidden" name="clientId" value={clientId} />
    </>
  );
}
