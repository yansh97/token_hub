type FieldRequirementProps = {
  required: boolean;
};

export function FieldRequirement({ required }: FieldRequirementProps) {
  if (!required) {
    return null;
  }
  return (
    <span
      aria-hidden="true"
      className="inline-block text-[11px] font-normal leading-4 text-foreground/60 before:content-['*']"
    />
  );
}

type FieldErrorProps = {
  id?: string;
  message?: string;
};

export function FieldError({ id, message }: FieldErrorProps) {
  if (!message) {
    return null;
  }
  return (
    <p id={id} className="text-[11px] leading-4 text-destructive">
      {message}
    </p>
  );
}
