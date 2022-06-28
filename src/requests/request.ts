import { REST_URL } from "../constants.ts";
import { HTTPMethod, Rest } from "../typings/rest.d.ts";

let reqs = 0;
let resetAt = 0;

export async function createRequest(rest: Rest, method: HTTPMethod, route: string, content?: Record<string, unknown>, skipResponse?: boolean): Promise<Record<string, unknown>> {
  const currentTime = new Date().valueOf();
  let timeOffset = 0;

  reqs++;
  if (reqs + 1 >= rest.globalRequestLimit) {
    if (currentTime < resetAt) {
      timeOffset += 4500 + rest.cooldownOffset;
      reqs = 0;
    } else resetAt = currentTime + 4500 + rest.cooldownOffset;
  }

  timeOffset += rest.buckets.get(route) ?? 0;

  return new Promise(function (resolve) {
    setTimeout(async function () {
      const res = await fetch(REST_URL + route, {
        method,
        headers: {
          "User-Agent": "DiscordApp https://github.com/Amatsagu/tempest",
          "Content-Type": "application/json",
          Authorization: rest.token
        },
        body: content && JSON.stringify(content)
      });

      if (res.status == 429 || res.headers.get("x-ratelimit-global")) {
        setTimeout(function () {
          resolve(createRequest(rest, method, route, content, skipResponse));
        }, ~~res.headers.get("x-ratelimit-reset-after")! * 4500 + rest.cooldownOffset);
      }

      const remaining = res.headers.get("x-ratelimit-remaining");
      if (remaining && ~~remaining == 0) rest.buckets.set(route, ~~res.headers.get("x-ratelimit-reset")! - currentTime / 1000 + 1000 + rest.cooldownOffset);
      else rest.buckets.delete(route);

      // @ts-ignore Return nothing as requested.
      if (skipResponse || res.status == 204) resolve();
      else resolve(res.json());
    }, timeOffset);
  });
}