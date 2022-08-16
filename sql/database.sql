/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

DROP TABLE IF EXISTS `access_levels`;
CREATE TABLE IF NOT EXISTS `access_levels` (
  `id` smallint(5) unsigned NOT NULL AUTO_INCREMENT,
  `rank` varchar(50) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `level` smallint(5) unsigned NOT NULL DEFAULT 0,
  `max_instances` int(10) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `level` (`rank`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8;

INSERT INTO `access_levels` (`id`, `rank`, `level`, `max_instances`) VALUES
	(1, 'Unregistered', 0, 0),
	(2, 'Member', 1, 1),
	(3, 'Moderator', 2, -1),
	(4, 'Admin', 3, -1),
	(5, 'Super Admin', 4, -1);

DROP TABLE IF EXISTS `cloud_save`;
CREATE TABLE IF NOT EXISTS `cloud_save` (
  `user_id` bigint(20) unsigned NOT NULL,
  `jsonData` mediumtext DEFAULT NULL,
  `jsonDataKey` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`user_id`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


DROP TABLE IF EXISTS `map`;
CREATE TABLE IF NOT EXISTS `map` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `chunkPosX` int(11) NOT NULL,
  `chunkPosY` int(11) NOT NULL,
  `tile` enum('wall','floor') CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL DEFAULT 'wall',
  `created` timestamp NOT NULL DEFAULT current_timestamp(),
  `seededBy` bigint(20) unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `tile` (`tile`),
  KEY `posX_posY` (`chunkPosX`,`chunkPosY`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;


DROP TABLE IF EXISTS `settings`;
CREATE TABLE IF NOT EXISTS `settings` (
  `setting` varchar(50) DEFAULT NULL,
  `value` mediumtext DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1;

INSERT INTO `settings` (`setting`, `value`) VALUES
	('gridSize', '512'),
	('playerScale', '0.75'),
	('mapWidth', '999'),
	('mapHeight', '999');

DROP TABLE IF EXISTS `sql_error`;
CREATE TABLE IF NOT EXISTS `sql_error` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `error` longtext COLLATE utf8_unicode_ci DEFAULT NULL,
  `query` longtext COLLATE utf8_unicode_ci DEFAULT NULL,
  `page` varchar(50) COLLATE utf8_unicode_ci DEFAULT '',
  `line` int(10) unsigned DEFAULT NULL,
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;


DROP TABLE IF EXISTS `user_auth`;
CREATE TABLE IF NOT EXISTS `user_auth` (
  `user_id` bigint(20) unsigned NOT NULL DEFAULT 0,
  `username` varchar(30) COLLATE utf8_unicode_ci NOT NULL,
  `discriminator` varchar(10) COLLATE utf8_unicode_ci NOT NULL,
  `access_token` varchar(40) COLLATE utf8_unicode_ci NOT NULL,
  `user_auth_key` varchar(40) COLLATE utf8_unicode_ci NOT NULL,
  `access_level` varchar(50) COLLATE utf8_unicode_ci NOT NULL DEFAULT 'Member',
  `nickname` varchar(30) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `discord_avatar` varchar(40) COLLATE utf8_unicode_ci DEFAULT NULL,
  `online` enum('Y','N') COLLATE utf8_unicode_ci NOT NULL DEFAULT 'N',
  `open_instances` int(10) unsigned NOT NULL DEFAULT 0,
  `online_page` varchar(50) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `last_ping` int(10) unsigned NOT NULL DEFAULT 0,
  `last_ip` varchar(40) COLLATE utf8_unicode_ci NOT NULL DEFAULT '',
  `last_login` int(10) unsigned NOT NULL DEFAULT 0,
  `created` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`) USING BTREE,
  KEY `access_token` (`access_token`),
  KEY `username_discriminator` (`username`,`discriminator`),
  KEY `user_auth_key` (`user_auth_key`),
  KEY `FK_user_auth_access_levels` (`access_level`),
  CONSTRAINT `FK_user_auth_access_levels` FOREIGN KEY (`access_level`) REFERENCES `access_levels` (`rank`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;


/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
