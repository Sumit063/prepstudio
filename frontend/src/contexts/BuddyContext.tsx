import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

type BuddyContextValue = {
  version: number;
  bump: () => void;
};

const BuddyContext = createContext<BuddyContextValue | undefined>(undefined);

export const BuddyProvider = ({ children }: { children: ReactNode }) => {
  const [version, setVersion] = useState(0);
  const value = useMemo(
    () => ({
      version,
      bump: () => setVersion((prev) => prev + 1),
    }),
    [version]
  );

  return <BuddyContext.Provider value={value}>{children}</BuddyContext.Provider>;
};

export const useBuddyContext = () => {
  const context = useContext(BuddyContext);
  if (!context) {
    throw new Error("useBuddyContext must be used within BuddyProvider");
  }
  return context;
};
