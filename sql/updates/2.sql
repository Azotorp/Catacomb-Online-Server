ALTER TABLE `map`
    CHANGE COLUMN `created` `created` TIMESTAMP NOT NULL DEFAULT current_timestamp() AFTER `seededBy`,
    ADD COLUMN `changedBy` BIGINT(20) UNSIGNED NOT NULL DEFAULT '0' AFTER `created`,
    ADD COLUMN `changed` TIMESTAMP NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() AFTER `changedBy`;