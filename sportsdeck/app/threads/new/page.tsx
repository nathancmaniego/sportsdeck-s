// Prompt: Create Thread form — title, content, tags (inline creation), team selection
'use client'

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type Team = { id: number; shortName: string };

export default function NewThreadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch teams for dropdown
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
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch('/api/threads', {
        method: 'POST',
        body: JSON.stringify({
          title,
          content,
          tags,
          teamId: teamId ? parseInt(teamId) : undefined,
        }),
      });
      const resThread = await res as import('@/types').Thread;
      if (resThread && resThread.id) {
        router.push(`/threads/${resThread.id}`);
      } else {
        setError('Failed to create thread.');
      }
    } catch (err) {
      setError('Failed to create thread.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <div className="p-8 text-muted-foreground font-body">You must be signed in to create a thread.</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-extrabold mb-6">Create New Thread</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-1 font-medium">Title</label>
          <Input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Thread title"
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post..."
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 min-h-[120px] font-body"
            required
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Tags</label>
          <div className="flex gap-2 mb-2">
            <Input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Add tag"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button type="button" onClick={handleAddTag} variant="secondary">
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => handleRemoveTag(tag)}>
                {tag} ×
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <label className="block mb-1 font-medium">Team (optional)</label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 font-body"
          >
            <option value="">General Forum</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.shortName}
              </option>
            ))}
          </select>
        </div>
        {error && <div className="text-destructive font-medium">{error}</div>}
        <Button type="submit" disabled={loading}>
          {loading ? 'Posting...' : 'Create Thread'}
        </Button>
      </form>
    </div>
  );
}
