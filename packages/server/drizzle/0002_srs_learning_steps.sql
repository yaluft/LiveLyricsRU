-- FSRS tracks how far a card has advanced through its learning steps, separate
-- from `state`. Without it, a card in the middle of its learning sequence
-- restarts that sequence on every review, because the scheduler is handed a
-- card that claims to be at step zero.
ALTER TABLE `srs_cards` ADD COLUMN `learning_steps` integer DEFAULT 0 NOT NULL;
