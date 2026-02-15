const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

const TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tokyo",
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

export interface JstParts {
  readonly date: string;
  readonly time: string;
  readonly runId: string;
  readonly timestamp: string;
}

export function getJstParts(now: Date = new Date()): JstParts {
  const date = DATE_FORMATTER.format(now);
  const time = TIME_FORMATTER.format(now);
  const runId = time.replaceAll(":", "");

  return {
    date,
    time,
    runId,
    timestamp: `${date}T${time}+09:00`
  };
}
