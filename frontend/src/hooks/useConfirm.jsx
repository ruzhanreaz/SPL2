import { useState, useCallback } from "react";
import ConfirmModal from "../components/ConfirmModal";

export const useConfirm = () => {
  const [confirmState, setConfirmState] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "danger",
    onConfirm: () => {},
  });

  const showConfirm = useCallback(
    ({ title, message, confirmText, cancelText, variant, onConfirm }) => {
      return new Promise((resolve) => {
        setConfirmState({
          isOpen: true,
          title: title || "Confirm Action",
          message: message || "Are you sure you want to proceed?",
          confirmText: confirmText || "Confirm",
          cancelText: cancelText || "Cancel",
          variant: variant || "danger",
          onConfirm: () => {
            onConfirm && onConfirm();
            resolve(true);
          },
        });
      });
    },
    [],
  );

  const closeConfirm = useCallback(() => {
    setConfirmState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const ConfirmDialog = () => (
    <ConfirmModal
      isOpen={confirmState.isOpen}
      onClose={closeConfirm}
      onConfirm={confirmState.onConfirm}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      variant={confirmState.variant}
    />
  );

  return { showConfirm, ConfirmDialog };
};
