-- Full-text search over every lyric line ever fetched, so "find the song with
-- this line" works offline.  Drizzle has no FTS5 DSL, so this one is hand-written.
--
-- `unicode61` tokenises Cyrillic correctly and case-folds it, both verified in
-- migrate.test.ts.  What it does NOT do is fold ё to е: `remove_diacritics`
-- only strips marks from characters that decompose, and Cyrillic ё is its own
-- codepoint (U+0451), not е plus a combining diaeresis.  Russian writers use
-- the two interchangeably, so a search for "еще" has to find "ещё".
--
-- Hence a plain (non-external-content) FTS5 table holding a *folded* copy of
-- the text.  Queries must fold the search term the same way — use
-- `foldSearchText` from @lyrika/core, which is the JS twin of the `replace()`
-- pair below.  Keep the two in step.
CREATE VIRTUAL TABLE `lyric_lines_fts` USING fts5(
  `text`,
  tokenize='unicode61 remove_diacritics 2'
);
--> statement-breakpoint
CREATE TRIGGER `lyric_lines_fts_insert` AFTER INSERT ON `lyric_lines` BEGIN
  INSERT INTO `lyric_lines_fts`(`rowid`, `text`)
  VALUES (new.`id`, replace(replace(new.`text`, 'ё', 'е'), 'Ё', 'Е'));
END;
--> statement-breakpoint
CREATE TRIGGER `lyric_lines_fts_delete` AFTER DELETE ON `lyric_lines` BEGIN
  DELETE FROM `lyric_lines_fts` WHERE `rowid` = old.`id`;
END;
--> statement-breakpoint
CREATE TRIGGER `lyric_lines_fts_update` AFTER UPDATE ON `lyric_lines` BEGIN
  DELETE FROM `lyric_lines_fts` WHERE `rowid` = old.`id`;
  INSERT INTO `lyric_lines_fts`(`rowid`, `text`)
  VALUES (new.`id`, replace(replace(new.`text`, 'ё', 'е'), 'Ё', 'Е'));
END;
