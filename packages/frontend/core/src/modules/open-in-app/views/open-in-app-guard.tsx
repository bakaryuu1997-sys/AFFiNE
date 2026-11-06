import { Fragment } from 'react';

/**
 * Upstream used this guard to push web users towards the AFFiNE desktop app.
 * This fork is a personal app with no such desktop build to hand over to, so
 * the guard just renders its children.
 */
export const OpenInAppGuard = Fragment;
