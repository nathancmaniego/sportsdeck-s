// Prompt: Create Thread Form Implementation
'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import type { Team } from '@/types';

export default function NewThreadPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');

  const loadTeams = useCallback(async () => {
    try {
      const data = await apiFetch<{ teams: Team[] }>('/api/teams');
      setTeams(data.teams || []);
    } catch {
      setTeams([]);
    }
  }, []);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag)) {
      setTags((prev) => [...prev, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !selectedTeam) return;

    try {
      await apiFetch('/api/threads', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          tags,
          teamId: selectedTeam,
        }),
      });
      router.push('/forums');
    } catch (error) {
      console.error('Failed to create thread:', error);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight sm:text-4xl mb-6">
        Create New Thread
      </h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium font-body mb-2">Title</label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter thread title"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium font-body mb-2">Content</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your thread content here..."
            rows={6}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium font-body mb-2">Tags</label>
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add a tag"
            />
            <Button type="button" onClick={handleAddTag}>
              Add Tag
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                onClick={() => handleRemoveTag(tag)}
                className="cursor-pointer"
              >
                {tag} ×
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium font-body mb-2">Select Team</label>
          <select
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="w-full rounded-lg border border-[var(--sd-border-subtle)] bg-[var(--sd-surface)] px-3 py-2 text-sm font-body"
            required
          >
            <option value="">Select a team</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.shortName}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" className="w-full">
          Create Thread
        </Button>
      </form>
    </div>
  );
}
