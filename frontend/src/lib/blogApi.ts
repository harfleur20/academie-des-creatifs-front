import { apiRequest } from "./apiClient";

export type BlogPost = {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  cover_image: string;
  author: string;
  category: string;
  is_featured: boolean;
  is_popular: boolean;
  published_at: string;
  rating: number;
  reviews_count: number;
};

export type BlogPostPayload = Omit<BlogPost, "id">;
export type BlogPostUpdatePayload = Partial<Omit<BlogPost, "id" | "slug">>;

export function fetchBlogPosts(): Promise<BlogPost[]> {
  return apiRequest<BlogPost[]>("/blog");
}

export function fetchFeaturedPosts(): Promise<BlogPost[]> {
  return apiRequest<BlogPost[]>("/blog/featured");
}

export function fetchBlogPost(slug: string): Promise<BlogPost> {
  return apiRequest<BlogPost>(`/blog/${slug}`);
}

export function createBlogPost(payload: BlogPostPayload): Promise<BlogPost> {
  return apiRequest<BlogPost>("/blog/admin", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBlogPost(id: number, payload: BlogPostUpdatePayload): Promise<BlogPost> {
  return apiRequest<BlogPost>(`/blog/admin/${id}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteBlogPost(id: number): Promise<void> {
  return apiRequest<void>(`/blog/admin/${id}`, { method: "DELETE" });
}

export function rateBlogPost(slug: string, stars: number): Promise<BlogPost> {
  return apiRequest<BlogPost>(`/blog/${slug}/rate`, {
    method: "POST",
    body: JSON.stringify({ stars }),
  });
}
