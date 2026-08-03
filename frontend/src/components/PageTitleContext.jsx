import React, { createContext, useContext, useMemo, useState } from "react";

const PageTitleContext = createContext({
  pageTitle: "",
  setPageTitle: () => {},
});

export const PageTitleProvider = ({ children }) => {
  const [pageTitle, setPageTitle] = useState("");

  const value = useMemo(
    () => ({
      pageTitle,
      setPageTitle,
    }),
    [pageTitle],
  );

  return (
    <PageTitleContext.Provider value={value}>
      {children}
    </PageTitleContext.Provider>
  );
};

export const usePageTitle = () => useContext(PageTitleContext);
