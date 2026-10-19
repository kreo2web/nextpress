type AiFieldErrorProps = {
  id: string;
  message?: string;
};

/** The message under an input the server (or the form) marked. Announced as it appears. */
export function AiFieldError({ id, message }: AiFieldErrorProps) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-red-600 dark:text-red-400">
      {message}
    </p>
  );
}
