import assert from "node:assert/strict";
import { test } from "node:test";
import { FEED_TAGS, findFeedTag, PUBLISHED_TYPES } from "../src/lib/feed";

test("봇이 올리는 타입은 전부 태그로 모을 수 있다", () => {
  // 유튜브를 붙이고 태그를 안 더해서 영상 45건이 어떤 태그로도 안 모인 적이 있다.
  const covered = new Set(FEED_TAGS.flatMap((t) => t.types));
  for (const type of PUBLISHED_TYPES) {
    assert.ok(covered.has(type), `'${type}' 을 모을 태그가 없다. FEED_TAGS 에 더해라`);
  }
});

test("태그가 없는 타입을 가리키지 않는다", () => {
  const published = new Set<string>(PUBLISHED_TYPES);
  for (const tag of FEED_TAGS) {
    for (const type of tag.types) {
      assert.ok(
        published.has(type),
        `#${tag.label} 이 '${type}' 을 가리키는데 그건 올리지 않는 타입이다`,
      );
    }
  }
});

test("slug 은 겹치지 않는다", () => {
  const slugs = FEED_TAGS.map((t) => t.slug);
  assert.equal(new Set(slugs).size, slugs.length, `slug 중복: ${slugs.join(", ")}`);
});

test("모르는 slug 은 무시한다 — 오타 난 URL 로 빈 화면을 주지 않는다", () => {
  assert.equal(findFeedTag("없는태그"), undefined);
  assert.equal(findFeedTag(null), undefined);
  assert.equal(findFeedTag("video")?.label, "경기영상");
});
