import React from "react";
import { usePageTitle } from "../PageTitleContext";

const PageHeader = ({ title, subtitle, actions = null }) => {
  const { setPageTitle } = usePageTitle();

  React.useEffect(() => {
    setPageTitle(title || "");

    return () => setPageTitle("");
  }, [setPageTitle, title]);

  return (
    <div className="mb-4 md:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        {subtitle ? (
          <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="w-full min-w-0 sm:w-auto flex flex-wrap items-center justify-end sm:justify-end gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
};

export default PageHeader;
