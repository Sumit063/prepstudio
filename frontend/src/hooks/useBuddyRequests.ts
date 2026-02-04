import { useBuddies } from "./useBuddies";

export const useBuddyRequests = () => {
  const { pendingIncoming, pendingOutgoing, acceptRequest, removeRelationship } = useBuddies();
  return { pendingIncoming, pendingOutgoing, acceptRequest, removeRelationship };
};
