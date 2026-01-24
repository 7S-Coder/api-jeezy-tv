/**
 * User Color Service
 * Handles color assignment and updates for user profiles
 */

import { prisma } from "@/lib/prisma";
import { generateUserColor } from "@/lib/colors";

/**
 * Update user profile color based on VIP status
 * When a user upgrades to VIP, they get a color from the VIP pool
 * @param userId - The user ID
 * @param isVip - Whether the user is VIP
 * @returns Updated user with new color
 */
export async function updateUserProfileColor(userId: string, isVip: boolean) {
  const newColor = generateUserColor(isVip);
  
  return prisma.user.update({
    where: { id: userId },
    data: {
      profileColor: newColor,
    },
    select: {
      id: true,
      email: true,
      name: true,
      profileColor: true,
      role: true,
    },
  });
}

/**
 * Get a user's profile color
 * @param userId - The user ID
 * @returns User's profile color
 */
export async function getUserProfileColor(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profileColor: true,
      role: true,
    },
  });
  
  return user?.profileColor || "#3498db"; // Default color if not set
}

/**
 * Regenerate a user's profile color
 * Useful if user wants a new random color
 * @param userId - The user ID
 * @param isVip - Whether the user is VIP
 * @returns Updated user with new color
 */
export async function regenerateUserColor(userId: string, isVip: boolean) {
  return updateUserProfileColor(userId, isVip);
}
