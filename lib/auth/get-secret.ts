/**
 * Utility function to get consistent JWT secret across frontend and backend
 * IMPORTANT: NEXTAUTH_SECRET must be defined in .env
 */
export function getJWTSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret || secret === 'your_generated_secret_here_min_32_chars') {
    const fallback = 'test-secret-key-fallback-32-chars!';
    console.warn('[getJWTSecret] ⚠️ NEXTAUTH_SECRET is not properly configured! Using fallback (insecure for production)');
    return fallback;
  }
  return secret;
}
