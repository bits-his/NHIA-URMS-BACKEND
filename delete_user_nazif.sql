-- Delete user: Nazif Abdullahi (abc2060d-71fc-4d01-8200-d78f015b8a0a)
-- Run against live linkme_db database

SET @user_id = 'abc2060d-71fc-4d01-8200-d78f015b8a0a';

START TRANSACTION;

-- Video calls block user deletion (ON DELETE NO ACTION)
DELETE FROM video_calls
WHERE callerId = @user_id OR receiverId = @user_id OR ratedBy = @user_id;

-- Notifications about this user on other accounts
DELETE FROM notifications
WHERE relatedUserId = @user_id;

-- Rating comments by this user
DELETE FROM rating_comments
WHERE userId = @user_id;

-- Reports by this user
DELETE FROM reports
WHERE reportedBy = @user_id;

-- Transactions tied to this user's wallet
DELETE FROM transactions
WHERE userId = @user_id;

-- Deleting the user cascades: follows, messages, posts, guidances,
-- verifications, wallet, subscriptions, likes, comments, saves, notifications (userId)
DELETE FROM users
WHERE id = @user_id;

-- Fix follower/following counts for affected users
UPDATE users u
SET
  followersCount = (
    SELECT COUNT(*) FROM follows f WHERE f.followingId = u.id
  ),
  followingCount = (
    SELECT COUNT(*) FROM follows f WHERE f.followerId = u.id
  )
WHERE u.id IN (
  SELECT DISTINCT affected_id FROM (
    SELECT followerId AS affected_id FROM follows
    UNION
    SELECT followingId AS affected_id FROM follows
  ) AS affected_users
);

COMMIT;
