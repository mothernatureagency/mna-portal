'use client';
import React, { useState } from 'react';

type CaptionMap = { [key: string]: string };

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Post = { platform: string; type: string; topic: string; color: string };
type DayEntry = { date: number; dayOfWeek: string; posts: Post[] };
type MonthMap = { [key: string]: DayEntry[] };

const DATA: MonthMap = {
  '2026-2': [
    { dayOfWeek: 'Mon', date: 2, posts: [{ platform: 'IG', type: 'Reel', topic: 'March Preview', color: '#e879f9' }] },
    { dayOfWeek: 'Fri', date: 27, posts: [{ platform: 'Email', type: 'Newsletter', topic: 'Month Recap', color: '#f59e0b' }] },
  ],
  '2026-3': [
    { dayOfWeek: 'Mon', date: 6, posts: [{ platform: 'IG', type: 'Reel', topic: 'Before/After', color: '#e879f9' }] },
    { dayOfWeek: 'Tue', date: 7, posts: [{ platform: 'FB', type: 'Post', topic: 'Client Results', color: '#3b82f6' }] },
    { dayOfWeek: 'Wed', date: 8, posts: [{ platform: 'IG', type: 'Story', topic: 'Day in the Life', color: '#e879f9' }] },
    { dayOfWeek: 'Thu', date: 9, posts: [{ platform: 'Email', type: 'Newsletter', topic: 'April Promo', color: '#f59e0b' }] },
    { dayOfWeek: 'Fri', date: 10, posts: [{ platform: 'IG', type: 'Carousel', topic: 'Top 5 Benefits', color: '#e879f9' }] },
    { dayOfWeek: 'Mon', date: 13, posts: [{ platform: 'TT', type: 'Video', topic: 'Trend Sound', color: '#06b6d4' }] },
    { dayOfWeek: 'Tue', date: 14, posts: [{ platform: 'IG', type: 'Post', topic: 'Testimonial', color: '#e879f9' }] },
    { dayOfWeek: 'Wed', date: 15, posts: [{ platform: 'FB', type: 'Post', topic: 'Mid-Month Tips', color: '#3b82f6' }] },
    { dayOfWeek: 'Thu', date: 16, posts: [{ platform: 'IG', type: 'Reel', topic: 'Product Spotlight', color: '#e879f9' }] },
    { dayOfWeek: 'Fri', date: 17, posts: [{ platform: 'Email', type: 'Promo', topic: 'Weekend Deal', color: '#f59e0b' }] },
    { dayOfWeek: 'Mon', date: 20, posts: [{ platform: 'IG', type: 'Story', topic: 'Behind the Scenes', color: '#e879f9' }] },
    { dayOfWeek: 'Tue', date: 21, posts: [{ platform: 'TT', type: 'Video', topic: 'Tutorial', color: '#06b6d4' }] },
    { dayOfWeek: 'Wed', date: 22, posts: [{ platform: 'FB', type: 'Post', topic: 'Earth Day', color: '#3b82f6' }] },
    { dayOfWeek: 'Thu', date: 23, posts: [{ platform: 'IG', type: 'Carousel', topic: 'Spring Collection', color: '#e879f9' }] },
    { dayOfWeek: 'Fri', date: 24, posts: [
