import Follow from '#social/models/follow'
import Profile from '#social/models/profile'
import { HttpContext } from '@adonisjs/core/http'
import Database from '@adonisjs/lucid/services/db'

class FollowService {
  /**
   * Follow a profile.
   * Updates the follow relationship and increments the corresponding counters.
   */
  async follow(followerId: string, followingId: string) {
    if (followerId === followingId) {
      throw new Error('You cannot follow yourself.')
    }

    const existingFollow = await Follow.query()
      .where('follower_id', followerId)
      .where('following_id', followingId)
      .first()

    if (existingFollow) {
      throw new Error('Already following this profile.')
    }

    // search if both profiles exist or not
    const followerProfile = await Profile.find(followerId)
    const followingProfile = await Profile.find(followingId)

    if (!followerProfile || !followingProfile) {
      throw new Error('Profile not found.')
    }

    /**
     * Using a transaction to ensure that creating the follow record and updating counts
     * occur atomically.
     */
    const trx = await Database.transaction()
    try {
      // Create the follow record
      await Follow.create({ followerId, followingId }, { client: trx })

      // Increment follower/following counts on the Profile model
      await Profile.query({ client: trx }).where('id', followingId).increment('followersCount', 1)

      await Profile.query({ client: trx }).where('id', followerId).increment('followingCount', 1)

      await trx.commit()
      return true
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Unfollow a profile.
   * Removes the follow relationship and decrements the corresponding counters.
   */
  async unfollow(followerId: string, followingId: string) {
    // Check that the follow relationship exists
    const follow = await Follow.query()
      .where('follower_id', followerId)
      .where('following_id', followingId)
      .first()
    if (!follow) {
      throw new Error('Not following this profile.')
    }

    const trx = await Database.transaction()
    try {
      // Delete the follow record
      await follow.useTransaction(trx).delete()

      // Decrement the counters
      await Profile.query({ client: trx }).where('id', followingId).decrement('followersCount', 1)

      await Profile.query({ client: trx }).where('id', followerId).decrement('followingCount', 1)

      await trx.commit()
      return true
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Retrieve follower statistics directly from the Profile model.
   * This avoids expensive count queries each time.
   */
  async getFollowerStats(profileId: string) {
    const profile = await Profile.findOrFail(profileId)
    return {
      followersCount: profile.followersCount,
      followingCount: profile.followingCount,
    }
  }
}

const followService = new FollowService()

export default class FollowController {
  /**
   * Handle the follow request.
   */
  async follow({ params, response }: HttpContext) {
    try {
      const followerId = params.followerId
      const followingId = params.followingId

      await followService.follow(followerId, followingId)
      return true
    } catch (error) {
      return response.badRequest(error.message)
    }
  }

  /**
   * Handle the unfollow request.
   */
  async unfollow({ params, response }: HttpContext) {
    try {
      const followerId = params.followerId
      const followingId = params.followingId

      await followService.unfollow(followerId, followingId)
      return true
    } catch (error) {
      return response.badRequest(error.message)
    }
  }

  /**
   * Return follower/following stats.
   */
  async stats({ params, response }: HttpContext) {
    try {
      const stats = await followService.getFollowerStats(params.profileId)
      return response.json(stats)
    } catch (error) {
      return response.internalServerError('Error fetching stats')
    }
  }

  /**
   * Check if the authenticated user is following a profile.
   */
  async isFollowing({ params, response }: HttpContext) {
    const followerId = params.followerId
    const followingId = params.followingId

    const follow = await Follow.query()
      .where('follower_id', followerId)
      .where('following_id', followingId)
      .first()

    return response.json({ isFollowing: !!follow })
  }
}
