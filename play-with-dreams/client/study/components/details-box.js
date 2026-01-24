import EventEmitter from '../util/event-emitter.js';

function audioUrlToPlayableUrl(url){
  if(!url) return url;

  // If this is a local upload served from atra (/uploads/...), use as-is (ogg/other formats are fine in modern browsers)
  if (url.startsWith('/uploads/')) {
    return url;
  }

  // If this is a Windows path (from older data), map it to /uploads/<filename>.mp3
  if (/^[a-zA-Z]:\\/.test(url) || url.includes('\\uploads\\')) {
    const parts = url.split(/[/\\]/);
    const fileName = parts[parts.length - 1].replace(/\.[a-z0-9]+$/i, '.mp3');
    return `/uploads/${fileName}`;
  }

  // For Cloudinary video URLs, convert to mp3 with volume boost
  if (url.includes('/video/upload/')) {
    return url
      .replace(/\.[a-z0-9]+$/i, '.mp3')
      .replace('/video/upload/', '/video/upload/e_volume:250/');
  }

  // Fallback: return original URL
  return url;
}

class DetailsBox extends EventEmitter {
  constructor(el){
    super();
    this.containerEl = el;
    this.boxEl = el.querySelector('.details-box');
    this.bindClose();
  }

  bindClose(){
    this.boxEl.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    this.containerEl.addEventListener('click', (e) => {
      // if(this.iShowing && e.target === this.containerEl){
        this.hide();
        if(document.querySelector('.stage-item.is-open')){
          document.querySelector('.stage-item.is-open').classList.remove('is-open');
        }
      // }
    });
  }

  async showItem(item, language, isFixed, datastore){
    this.item = item;
    this.language = language;
    this.isFixed = !!isFixed;
    this.datastore = datastore;
    this.containerEl.classList.toggle('fixed', isFixed);
    this.containerEl.setAttribute('dir', language === 'en' ? 'ltr' : 'rtl');
    this.containerEl.classList.remove('hidden');
    
    // Load comments for this item
    let comments = [];
    if(datastore && item._id){
      try {
        comments = await datastore.getComments(item._id);
      } catch(error){
        console.error('Error loading comments:', error);
      }
    }
    
    // Ensure itemId is a string for use in HTML IDs and API calls
    const itemId = item._id?.toString ? item._id.toString() : item._id;
    
    // Get comment translations based on language
    const commentTranslations = {
      he: {
        title: 'תגובות ומחשבות',
        placeholder: 'שתף את מחשבותיך או חוויות דומות...',
        namePlaceholder: 'שמך (אופציונלי)',
        button: 'פרסם תגובה',
        noComments: 'אין תגובות עדיין. היה הראשון לשתף את מחשבותיך!'
      },
      en: {
        title: 'Comments & Thoughts',
        placeholder: 'Share your thoughts or similar experiences...',
        namePlaceholder: 'Your name (optional)',
        button: 'Post Comment',
        noComments: 'No comments yet. Be the first to share your thoughts!'
      },
      ar: {
        title: 'التعليقات والأفكار',
        placeholder: 'شارك أفكارك أو تجارب مماثلة...',
        namePlaceholder: 'اسمك (اختياري)',
        button: 'نشر تعليق',
        noComments: 'لا توجد تعليقات بعد. كن أول من يشارك أفكاره!'
      }
    };
    
    const t = commentTranslations[language] || commentTranslations.en;
    
    // Helper function to get comment text in current language
    // Fallback to original text if translation doesn't exist
    const getCommentText = (comment) => {
      return comment[language] || comment.text || '';
    };
    
    const displayText = item[language] || item.text || '';

    this.boxEl.innerHTML = `<div class="stage-item__details">
        <div class="stage-item__text">${displayText}</div>
        ${(item.audioUrl ? `<div class="stage-item__audio">
          <audio src="${audioUrlToPlayableUrl(item.audioUrl)}" controls></audio>
        </div>` : '')}
        <div class="comments-section">
          <h3 class="comments-title">${t.title}</h3>
          <div class="comments-list" id="comments-list-${itemId}">
            ${comments.length > 0 ? comments.map(comment => {
              const commentText = getCommentText(comment);
              return commentText ? `
              <div class="comment">
                <div class="comment-header">
                  <span class="comment-author">${comment.authorName || 'Anonymous'}</span>
                  <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
                <div class="comment-text">${commentText}</div>
              </div>
            ` : '';
            }).join('') : `<div class="no-comments">${t.noComments}</div>`}
          </div>
          <div class="add-comment">
            <textarea class="comment-input" id="comment-text-${itemId}" placeholder="${t.placeholder}" rows="3"></textarea>
            <div class="comment-form-row">
              <input type="text" class="comment-author-input" id="comment-author-${itemId}" placeholder="${t.namePlaceholder}" />
              <button class="comment-submit-btn" data-item-id="${itemId}">${t.button}</button>
            </div>
          </div>
        </div>
      </div>`
    
    // Bind comment submit button
    const submitBtn = this.boxEl.querySelector(`.comment-submit-btn[data-item-id="${itemId}"]`);
    if(submitBtn){
      submitBtn.addEventListener('click', () => this.handleCommentSubmit(itemId));
    }
    
    // Allow Enter+Shift for new line, Enter alone to submit
    const commentInput = this.boxEl.querySelector(`#comment-text-${itemId}`);
    if(commentInput){
      commentInput.addEventListener('keydown', (e) => {
        if(e.key === 'Enter' && !e.shiftKey){
          e.preventDefault();
          this.handleCommentSubmit(itemId);
        }
      });
    }
    
    this.iShowing = true;
    this.emit('show', item);
  }

  async handleCommentSubmit(itemId){
    if(!this.datastore) {
      console.error('Datastore not available');
      return;
    }
    
    const textInput = this.boxEl.querySelector(`#comment-text-${itemId}`);
    const authorInput = this.boxEl.querySelector(`#comment-author-${itemId}`);
    const commentsList = this.boxEl.querySelector(`#comments-list-${itemId}`);
    
    const text = textInput?.value?.trim();
    const authorName = authorInput?.value?.trim();
    
    if(!text){
      return; // Don't submit empty comments
    }
    
    // Convert itemId to string if it's an ObjectId
    const itemIdStr = itemId?.toString ? itemId.toString() : itemId;
    
    if(!itemIdStr){
      console.error('Item ID is missing');
      if(window.showToast) {
        window.showToast('Error: Dream ID is missing. Please refresh and try again.', 'error');
      } else {
        alert('Error: Dream ID is missing. Please refresh and try again.');
      }
      return;
    }
    
    try {
      console.log('Submitting comment for item:', itemIdStr);
      // Pass current language when submitting comment
      const result = await this.datastore.addComment(itemIdStr, text, authorName, this.language);
      console.log('Comment submission result:', result);
      
      if(result.success && result.comment){
        // Clear input
        textInput.value = '';
        if(authorInput) authorInput.value = '';
        
        // Add new comment to the list (at the top)
        const noCommentsMsg = commentsList.querySelector('.no-comments');
        if(noCommentsMsg){
          noCommentsMsg.remove();
        }
        
        // Get comment text in current language
        const commentText = result.comment[this.language] || result.comment.text || '';
        
        const commentEl = document.createElement('div');
        commentEl.className = 'comment';
        commentEl.innerHTML = `
          <div class="comment-header">
            <span class="comment-author">${result.comment.authorName || 'Anonymous'}</span>
            <span class="comment-date">${new Date(result.comment.createdAt).toLocaleDateString()}</span>
          </div>
          <div class="comment-text">${commentText}</div>
        `;
        commentsList.insertBefore(commentEl, commentsList.firstChild);
      } else {
        console.error('Unexpected response format:', result);
        if(window.showToast) {
          window.showToast('Failed to post comment. Unexpected response from server.', 'error');
        } else {
          alert('Failed to post comment. Unexpected response from server.');
        }
      }
    } catch(error){
      console.error('Error submitting comment:', error);
      console.error('Error details:', error.message);
      console.error('Item ID used:', itemIdStr);
      if(window.showToast) {
        window.showToast(`Failed to post comment: ${error.message || 'Please try again.'}`, 'error');
      } else {
        alert(`Failed to post comment: ${error.message || 'Please try again.'}`);
      }
    }
  }

  async translate(language){
    if(this.iShowing){
      this.language = language;
      const textEl = this.boxEl.querySelector('.stage-item__text');
      textEl.textContent = this.item[language] ?? this.item.text;
      this.containerEl.setAttribute('dir', language === 'en' ? 'ltr' : 'rtl');
      
      // Update comment translations
      const commentTranslations = {
        he: {
          title: 'תגובות ומחשבות',
          placeholder: 'שתף את מחשבותיך או חוויות דומות...',
          namePlaceholder: 'שמך (אופציונלי)',
          button: 'פרסם תגובה',
          noComments: 'אין תגובות עדיין. היה הראשון לשתף את מחשבותיך!'
        },
        en: {
          title: 'Comments & Thoughts',
          placeholder: 'Share your thoughts or similar experiences...',
          namePlaceholder: 'Your name (optional)',
          button: 'Post Comment',
          noComments: 'No comments yet. Be the first to share your thoughts!'
        },
        ar: {
          title: 'التعليقات والأفكار',
          placeholder: 'شارك أفكارك أو تجارب مماثلة...',
          namePlaceholder: 'اسمك (اختياري)',
          button: 'نشر تعليق',
          noComments: 'لا توجد تعليقات بعد. كن أول من يشارك أفكاره!'
        }
      };
      
      const t = commentTranslations[language] || commentTranslations.en;
      
      // Update comment section title
      const titleEl = this.boxEl.querySelector('.comments-title');
      if(titleEl) titleEl.textContent = t.title;
      
      // Update placeholders
      const commentInput = this.boxEl.querySelector('.comment-input');
      if(commentInput) commentInput.placeholder = t.placeholder;
      
      const authorInput = this.boxEl.querySelector('.comment-author-input');
      if(authorInput) authorInput.placeholder = t.namePlaceholder;
      
      const submitBtn = this.boxEl.querySelector('.comment-submit-btn');
      if(submitBtn) submitBtn.textContent = t.button;
      
      // Reload and update existing comments to show in current language
      if(this.datastore && this.item._id){
        try {
          const comments = await this.datastore.getComments(this.item._id);
          const itemId = this.item._id?.toString ? this.item._id.toString() : this.item._id;
          const commentsList = this.boxEl.querySelector(`#comments-list-${itemId}`);
          
          if(commentsList){
            // Clear existing comments
            commentsList.innerHTML = '';
            
            if(comments.length > 0){
              comments.forEach(comment => {
                // Get comment text in current language
                const commentText = comment[language] || comment.text || '';
                if(commentText){
                  const commentEl = document.createElement('div');
                  commentEl.className = 'comment';
                  commentEl.innerHTML = `
                    <div class="comment-header">
                      <span class="comment-author">${comment.authorName || 'Anonymous'}</span>
                      <span class="comment-date">${new Date(comment.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div class="comment-text">${commentText}</div>
                  `;
                  commentsList.appendChild(commentEl);
                }
              });
            } else {
              commentsList.innerHTML = `<div class="no-comments">${t.noComments}</div>`;
            }
          }
        } catch(error){
          console.error('Error reloading comments for translation:', error);
        }
      }
    }
  }

  hide(){
    this.isFixed = false;
    this.iShowing = false;
    this.boxEl.innerHTML = '';
    this.containerEl.classList.add('hidden');
    this.containerEl.classList.remove('fixed');
    this.emit('close');
  }

  hideIfNotFixed(){
    if(!this.isFixed){
      this.hide();
    }
  }
}

export default DetailsBox;