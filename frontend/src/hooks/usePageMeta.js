import { useEffect } from "react";
import { usePageTitle } from "../components/PageTitleContext";

const upsertMetaTag = (selector, attributes) => {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    Object.entries(attributes).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
    document.head.appendChild(element);
  }

  if (attributes.content) {
    element.setAttribute("content", attributes.content);
  }
};

export default function usePageMeta({
  title,
  description,
  ogTitle,
  ogDescription,
}) {
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    if (title) {
      document.title = title;
    }

    setPageTitle(title || "");

    if (description) {
      upsertMetaTag('meta[name="description"]', {
        name: "description",
        content: description,
      });
    }

    upsertMetaTag('meta[property="og:type"]', {
      property: "og:type",
      content: "website",
    });

    if (ogTitle || title) {
      upsertMetaTag('meta[property="og:title"]', {
        property: "og:title",
        content: ogTitle || title,
      });
    }

    if (ogDescription || description) {
      upsertMetaTag('meta[property="og:description"]', {
        property: "og:description",
        content: ogDescription || description,
      });
    }

    return () => setPageTitle("");
  }, [title, description, ogTitle, ogDescription]);
}
