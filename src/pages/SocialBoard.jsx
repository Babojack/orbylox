import React, { useState, useMemo } from 'react';
import { api } from "@/api/apiClient";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Send, MessageCircle, MoreHorizontal, Image, X, ChevronDown, ChevronUp, Smile, Trash2, Pin, PinOff } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/use-toast";
import ImageCollage from "@/components/feed/ImageCollage";
import { useLanguage } from "@/components/LanguageProvider";

function avatarSeedFromEmail(email = "") {
  // Avoid leaking raw emails in third-party avatar URLs.
  const normalized = (email || "").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return `u${hash.toString(16)}`;
}

export default function SocialBoard() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [newPostContent, setNewPostContent] = useState("");
  const [selectedImages, setSelectedImages] = useState([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [expandedComments, setExpandedComments] = useState({});
  const [newComments, setNewComments] = useState({});
  
  const searchParams = new URLSearchParams(window.location.search);
  const projectId = searchParams.get('project');

  const { data: posts = [], isLoading, isError: postsLoadError, error: postsLoadErrorObj, refetch: refetchPosts } = useQuery({
    queryKey: ['posts', projectId],
    queryFn: async () => {
      const allPosts = await api.entities.Post.filter({ project_id: projectId }, '-created_date', 200);
      return allPosts;
    },
    staleTime: 30000,
    enabled: !!projectId,
  });
  if (postsLoadError && postsLoadErrorObj) {
    console.error("[Feed] Posts load failed:", postsLoadErrorObj);
  }

  const { data: user, isLoading: userLoading, isError: userError } = useQuery({ 
    queryKey: ['currentUser'], 
    queryFn: () => api.auth.me(),
    retry: false
  });

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (userError || (!userLoading && !user)) {
      api.auth.redirectToLogin(window.location.pathname);
    }
  }, [user, userLoading, userError]);

  // Fetch comments with optimized settings
  const { data: allComments = [] } = useQuery({
    queryKey: ['postComments', projectId],
    queryFn: () => api.entities.PostComment.list('-created_date', 500),
    staleTime: 30000,
    enabled: !!projectId
  });

  const createPostMutation = useMutation({
    mutationFn: (postData) => api.entities.Post.create({
      ...postData,
      project_id: projectId, 
      author_email: user?.email,
      tags: ["general"],
      type: "update"
    }),
    onMutate: async (postData) => {
      await queryClient.cancelQueries(['posts', projectId]);
      const previous = queryClient.getQueryData(['posts', projectId]);
      const tempPost = {
        ...postData,
        id: 'temp_' + Date.now(),
        project_id: projectId,
        author_email: user?.email,
        tags: ["general"],
        created_date: new Date().toISOString(),
        likes: 0
      };
      queryClient.setQueryData(['posts', projectId], old => [tempPost, ...(old || [])]);
      setNewPostContent("");
      setSelectedImages([]);
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['posts', projectId], context?.previous ?? []);
      const msg = err?.message || t('postFailed');
      console.error("[Feed] Post create failed:", err);
      toast({
        title: t('postFailed'),
        description: msg,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries(['posts', projectId]);
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: ({ postId, content }) => api.entities.PostComment.create({
      post_id: postId,
      project_id: projectId,
      content,
      author_email: user?.email
    }),
    onMutate: async ({ postId, content }) => {
      await queryClient.cancelQueries(['postComments', projectId]);
      const previous = queryClient.getQueryData(['postComments', projectId]);
      const tempComment = {
        id: 'temp_' + Date.now(),
        post_id: postId,
        project_id: projectId,
        content,
        author_email: user?.email,
        created_date: new Date().toISOString()
      };
      queryClient.setQueryData(['postComments', projectId], old => [tempComment, ...(old || [])]);
      setNewComments(prev => ({ ...prev, [postId]: '' }));
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['postComments', projectId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['postComments', projectId]);
    }
  });

  const getPostComments = React.useCallback((postId) => {
    return allComments.filter(c => c.post_id === postId);
  }, [allComments]);

  const REACTIONS = [
    { emoji: '❤️', name: 'heart' },
    { emoji: '👍', name: 'thumbsup' },
    { emoji: '👏', name: 'clap' },
    { emoji: '🔥', name: 'fire' },
    { emoji: '🎉', name: 'party' },
    { emoji: '😂', name: 'laugh' },
    { emoji: '😮', name: 'wow' },
    { emoji: '💩', name: 'poop' },
  ];

  const deletePostMutation = useMutation({
    mutationFn: (postId) => api.entities.Post.delete(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries(['posts', projectId]);
      const previous = queryClient.getQueryData(['posts', projectId]);
      queryClient.setQueryData(['posts', projectId], old => (old || []).filter(p => p.id !== postId));
      return { previous };
    },
    onError: (err, postId, context) => {
      queryClient.setQueryData(['posts', projectId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['posts', projectId]);
    }
  });

  const togglePinMutation = useMutation({
    mutationFn: ({ postId, pinned }) => api.entities.Post.update(postId, {
      pinned,
      pinned_at: pinned ? new Date().toISOString() : null,
      pinned_by: pinned ? (user?.email || null) : null,
    }),
    onMutate: async ({ postId, pinned }) => {
      await queryClient.cancelQueries(['posts', projectId]);
      const previous = queryClient.getQueryData(['posts', projectId]);
      queryClient.setQueryData(['posts', projectId], old =>
        (old || []).map(p => p.id === postId
          ? {
              ...p,
              pinned,
              pinned_at: pinned ? new Date().toISOString() : null,
              pinned_by: pinned ? (user?.email || null) : null,
            }
          : p
        )
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['posts', projectId], context?.previous ?? []);
      console.error("[Feed] Pin update failed:", err);
      toast({
        title: t('pinFailed'),
        description: err?.message,
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries(['posts', projectId]);
    }
  });

  // Pinned posts first (most recently pinned on top), then the regular feed order.
  const sortedPosts = useMemo(() => {
    const timeOf = (value) => {
      const ms = new Date(value || 0).getTime();
      return Number.isNaN(ms) ? 0 : ms;
    };
    return [...posts].sort((a, b) => {
      if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
      if (a.pinned && b.pinned) return timeOf(b.pinned_at) - timeOf(a.pinned_at);
      return timeOf(b.created_date) - timeOf(a.created_date);
    });
  }, [posts]);

  const toggleReactionMutation = useMutation({
    mutationFn: ({ postId, emoji }) => {
      const post = posts.find(p => p.id === postId);
      const reactions = post?.reactions || {};
      const emojiReactions = reactions[emoji] || [];
      const userEmail = user?.email;
      
      let newEmojiReactions;
      if (emojiReactions.includes(userEmail)) {
        newEmojiReactions = emojiReactions.filter(e => e !== userEmail);
      } else {
        newEmojiReactions = [...emojiReactions, userEmail];
      }
      
      const newReactions = { ...reactions, [emoji]: newEmojiReactions };
      // Clean up empty arrays
      Object.keys(newReactions).forEach(key => {
        if (newReactions[key].length === 0) delete newReactions[key];
      });
      
      return api.entities.Post.update(postId, { reactions: newReactions });
    },
    onMutate: async ({ postId, emoji }) => {
      await queryClient.cancelQueries(['posts', projectId]);
      const previous = queryClient.getQueryData(['posts', projectId]);
      
      queryClient.setQueryData(['posts', projectId], old => 
        (old || []).map(p => {
          if (p.id !== postId) return p;
          const reactions = p.reactions || {};
          const emojiReactions = reactions[emoji] || [];
          const userEmail = user?.email;
          
          let newEmojiReactions;
          if (emojiReactions.includes(userEmail)) {
            newEmojiReactions = emojiReactions.filter(e => e !== userEmail);
          } else {
            newEmojiReactions = [...emojiReactions, userEmail];
          }
          
          const newReactions = { ...reactions, [emoji]: newEmojiReactions };
          Object.keys(newReactions).forEach(key => {
            if (newReactions[key].length === 0) delete newReactions[key];
          });
          
          return { ...p, reactions: newReactions };
        })
      );
      return { previous };
    },
    onError: (err, vars, context) => {
      queryClient.setQueryData(['posts', projectId], context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries(['posts', projectId]);
    }
  });

  const handleImageSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    // Max 4 images
    const remainingSlots = 4 - selectedImages.length;
    const filesToUpload = files.slice(0, remainingSlots);
    
    if (filesToUpload.length === 0) return;
    
    setUploadingImage(true);
    try {
      const uploadPromises = filesToUpload.map(file => 
        api.integrations.Core.UploadFile({ file })
      );
      const results = await Promise.all(uploadPromises);
      const urls = results.map(r => r.file_url);
      setSelectedImages(prev => [...prev, ...urls].slice(0, 4));
    } catch (error) {
      console.error('Failed to upload image:', error);
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePostSubmit = () => {
    const hasText = newPostContent.trim().length > 0;
    const hasImages = selectedImages.length > 0;
    if (!hasText && !hasImages) return;
    createPostMutation.mutate({
      content: hasText ? newPostContent.trim() : " ",
      images: hasImages ? selectedImages : undefined,
    });
  };

  if (userLoading || !user) {
    return <div className="flex items-center justify-center h-[50vh] text-slate-400">{t('loading')}</div>;
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-8 w-full min-w-0">
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t('projectFeed')}</h2>
          <p className="text-slate-500">{t('feedSubtitle')}</p>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <div className="w-8 h-8 border-4 border-[#ef5a24] border-t-transparent rounded-full animate-spin mb-4" />
          <span>{t('feedLoading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 w-full min-w-0">
      <div className="flex flex-col gap-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">{t('projectFeed')}</h2>
        <p className="text-slate-500">{t('feedSubtitle')}</p>
      </div>

      {/* Create Post Input */}
      <Card className="border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 pb-0">
           <Textarea 
            placeholder={t('whatsNew')} 
            className="border-none resize-none focus-visible:ring-0 text-lg min-h-[100px] placeholder:text-slate-300 w-full max-w-full min-w-0 [overflow-wrap:anywhere]"
            value={newPostContent}
            onChange={(e) => setNewPostContent(e.target.value)}
          />
          {selectedImages.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedImages.map((img, index) => (
                <div key={index} className="relative">
                  <img src={img} alt={`Preview ${index + 1}`} className="h-20 w-20 object-cover rounded-lg border border-slate-200" />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {selectedImages.length < 4 && (
                <label className="h-20 w-20 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-[#ef5a24] transition-colors">
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple
                    className="hidden" 
                    onChange={handleImageSelect}
                    disabled={uploadingImage}
                  />
                  <span className="text-2xl text-slate-400">+</span>
                </label>
              )}
            </div>
          )}
        </div>
        <div className="p-4 bg-slate-50 flex justify-between items-center border-t border-slate-100">
           <div className="flex gap-2">
              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  multiple
                  className="hidden" 
                  onChange={handleImageSelect}
                  disabled={uploadingImage || selectedImages.length >= 4}
                />
                <Button variant="ghost" size="sm" className="text-slate-500 hover:text-[#ef5a24]" asChild disabled={selectedImages.length >= 4}>
                  <span>
                    <Image className="w-4 h-4 mr-2" />
                    {uploadingImage ? t('uploading') : t('photosCount', { used: selectedImages.length, max: 4 })}
                  </span>
                </Button>
              </label>
           </div>
           <Button
              onClick={handlePostSubmit}
              disabled={
                createPostMutation.isPending ||
                (!newPostContent.trim() && selectedImages.length === 0)
              }
              className="bg-[#ef5a24] hover:bg-black text-white rounded-full px-6"
            >
              {createPostMutation.isPending ? t('posting') : t('postSubmit')}
           </Button>
        </div>
      </Card>

      {/* Feed */}
      <div className="space-y-6">
        {postsLoadError ? (
          <div className="text-center py-10 p-6 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 font-medium">{t('feedLoadFailed')}</p>
            <p className="text-red-600 text-sm mt-1">{postsLoadErrorObj?.message || "Unbekannter Fehler"}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => refetchPosts()}>{t('retry')}</Button>
          </div>
        ) : isLoading ? (
           <div className="text-center py-10 text-slate-400">{t('feedLoading')}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 text-lg">{t('noPostsYet')}</p>
            <p className="text-slate-300 text-sm mt-2">{t('createFirstPost')}</p>
          </div>
        ) : sortedPosts.map((post) => (
          (() => {
            const allPostImages = Array.isArray(post.images)
              ? post.images
              : post.image_url
                ? [post.image_url]
                : [];
            const safePostImages = allPostImages.filter(
              (url) => typeof url === "string" && url.trim() !== "" && !url.startsWith("blob:")
            );
            return (
          <Card
            key={post.id}
            className={`shadow-sm hover:shadow-md transition-shadow min-w-0 max-w-full overflow-hidden ${
              post.pinned ? 'border-[#ef5a24]/30 bg-[#f5f5f5]' : 'border-slate-100'
            }`}
          >
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 border border-slate-100">
                   <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeedFromEmail(post.author_email)}`} />
                   <AvatarFallback>{post.author_email?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                   <div className="flex items-center gap-2">
                     <p className="text-sm font-medium text-slate-900">{t('teamMember')}</p>
                     {post.pinned && (
                       <Badge variant="secondary" className="bg-[#ef5a24]/10 text-[#ef5a24] font-normal gap-1 hover:bg-[#ef5a24]/10">
                         <Pin className="w-3 h-3 fill-[#ef5a24]" />
                         {t('pinnedPost')}
                       </Badge>
                     )}
                   </div>
                   <p className="text-xs text-slate-400">{format(new Date(post.created_date), 'MMM d, h:mm a')}</p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-slate-300">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => togglePinMutation.mutate({ postId: post.id, pinned: !post.pinned })}
                    disabled={String(post.id).startsWith('temp_')}
                  >
                    {post.pinned ? (
                      <><PinOff className="w-4 h-4 mr-2" /> {t('unpinPost')}</>
                    ) : (
                      <><Pin className="w-4 h-4 mr-2" /> {t('pinPost')}</>
                    )}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => deletePostMutation.mutate(post.id)}
                    className="text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('delete')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="pb-2 min-w-0 overflow-x-hidden">
              <div className="text-slate-700 whitespace-pre-wrap text-base leading-relaxed break-words [overflow-wrap:anywhere]">
                {post.content}
              </div>
              {safePostImages.length > 0 ? (
                <ImageCollage images={safePostImages} />
              ) : null}
              {post.tags && post.tags.length > 0 && (
                 <div className="flex gap-2 mt-4">
                    {post.tags.map(tag => (
                       <Badge key={tag} variant="secondary" className="bg-slate-100 text-slate-600 font-normal hover:bg-slate-200">
                          #{tag}
                       </Badge>
                    ))}
                 </div>
              )}
            </CardContent>
            <CardFooter className="pt-4 border-t border-slate-50 flex flex-col gap-4">
               {/* Reactions display */}
               {post.reactions && Object.keys(post.reactions).length > 0 && (
                 <div className="flex flex-wrap gap-2 w-full">
                   {Object.entries(post.reactions).map(([emoji, users]) => (
                     users.length > 0 && (
                       <button
                         key={emoji}
                         onClick={() => toggleReactionMutation.mutate({ postId: post.id, emoji })}
                         className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-all ${
                           users.includes(user?.email) 
                             ? 'bg-[#ef5a24]/10 border-2 border-[#ef5a24]' 
                             : 'bg-slate-100 hover:bg-slate-200 border-2 border-transparent'
                         }`}
                       >
                         <span className="text-base">{emoji}</span>
                         <span className="text-xs font-medium text-slate-600">{users.length}</span>
                       </button>
                     )
                   ))}
                 </div>
               )}
               
               <div className="flex gap-4 text-slate-400 w-full">
                 {/* Add Reaction Button */}
                 <Popover>
                   <PopoverTrigger asChild>
                     <button className="flex items-center gap-2 hover:text-[#ef5a24] transition-colors text-sm">
                       <Smile className="w-4 h-4" /> {t('react')}
                     </button>
                   </PopoverTrigger>
                   <PopoverContent className="w-auto p-2">
                     <div className="flex gap-1">
                       {REACTIONS.map(({ emoji, name }) => (
                         <button
                           key={name}
                           onClick={() => toggleReactionMutation.mutate({ postId: post.id, emoji })}
                           className="text-2xl hover:scale-125 transition-transform p-1 hover:bg-slate-100 rounded"
                         >
                           {emoji}
                         </button>
                       ))}
                     </div>
                   </PopoverContent>
                 </Popover>
                 
                 <button 
                   className="flex items-center gap-2 hover:text-[#ef5a24] transition-colors text-sm"
                   onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                 >
                    <MessageCircle className="w-4 h-4" /> 
                    {t('commentsCount', { count: getPostComments(post.id).length })}
                    {expandedComments[post.id] ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                 </button>
               </div>

               {/* Comments Section */}
               {expandedComments[post.id] && (
                 <div className="w-full space-y-3">
                   {/* Add Comment */}
                   <div className="flex gap-2">
                     <Input
                      placeholder={t('writeComment')}
                       value={newComments[post.id] || ''}
                       onChange={(e) => setNewComments(prev => ({ ...prev, [post.id]: e.target.value }))}
                       onKeyDown={(e) => {
                         if (e.key === 'Enter' && newComments[post.id]?.trim()) {
                           addCommentMutation.mutate({ postId: post.id, content: newComments[post.id] });
                         }
                       }}
                       className="flex-1 min-w-0"
                     />
                     <Button 
                       size="sm"
                       onClick={() => {
                         if (newComments[post.id]?.trim()) {
                           addCommentMutation.mutate({ postId: post.id, content: newComments[post.id] });
                         }
                       }}
                       disabled={!newComments[post.id]?.trim()}
                       className="bg-[#ef5a24] hover:bg-black"
                     >
                       <Send className="w-4 h-4" />
                     </Button>
                   </div>

                   {/* Comments List */}
                   <div className="space-y-2 max-h-60 overflow-y-auto">
                     {getPostComments(post.id).map((comment) => (
                       <div key={comment.id} className="flex gap-2 p-2 bg-slate-50 rounded-lg">
                         <Avatar className="h-6 w-6">
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatarSeedFromEmail(comment.author_email)}`} />
                           <AvatarFallback className="text-xs">{comment.author_email?.[0]}</AvatarFallback>
                         </Avatar>
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2">
                             <span className="text-xs font-medium text-slate-700">{comment.author_email?.split('@')[0]}</span>
                             <span className="text-xs text-slate-400">{format(new Date(comment.created_date), 'MMM d, h:mm a')}</span>
                           </div>
                           <p className="text-sm text-slate-600 break-words [overflow-wrap:anywhere]">{comment.content}</p>
                         </div>
                       </div>
                     ))}
                     {getPostComments(post.id).length === 0 && (
                     <p className="text-sm text-slate-400 text-center py-2">{t('noCommentsYet')}</p>
                     )}
                   </div>
                 </div>
               )}
            </CardFooter>
          </Card>
            );
          })()
        ))}
      </div>
    </div>
  );
}