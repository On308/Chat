const STORAGE_KEY = 'log_backups_data';
const THEME_KEY = 'log_backups_theme';
const RECENT_TAGS_KEY = 'log_backups_recent_tags';   // ← 추가
const RECENT_TAGS_MAX = 10;
const PAGE_SIZE = 11;

let posts = [];
let currentPage = 1;
let currentPostId = null;
let selectedTag = 'ALL';

// 초깃값 로드
window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadData();
  render();
});

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeButtonText(savedTheme);
}

function toggleDarkMode() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem(THEME_KEY, newTheme);
  updateThemeButtonText(newTheme);
}

function updateThemeButtonText(theme) {
  const btn = document.getElementById('darkModeBtn');
  if (btn) {
    btn.innerText = theme === 'dark' ? '☀️ ' : '🌙 ';
  }
}

function loadData() {
  const data = localStorage.getItem(STORAGE_KEY);
  posts = data ? JSON.parse(data) : [];
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

/* 필터링 및 정렬 로직 */
function getFilteredAndSortedPosts() {
  const sortOrder = document.getElementById('sortOrder') ? document.getElementById('sortOrder').value : 'newest';
  const searchInput = document.getElementById('searchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const bookmarkOnly = document.getElementById('bookmarkFilter') ? document.getElementById('bookmarkFilter').checked : false;

  let filtered = posts.filter(p => {
    const matchTag = (selectedTag === 'ALL') || (p.tags && p.tags.includes(selectedTag));
    const matchBookmark = !bookmarkOnly || p.isBookmarked;

    let matchSearch = true;
    if (query !== '') {
      const titleMatch = p.title ? p.title.toLowerCase().includes(query) : false;
      const questionMatch = p.question ? p.question.toLowerCase().includes(query) : false;
      const answerMatch = p.answer ? p.answer.toLowerCase().includes(query) : false;
      matchSearch = titleMatch || questionMatch || answerMatch;
    }

    return matchTag && matchBookmark && matchSearch;
  });

  filtered.sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  return filtered;
}

/* 뷰 전환 */
function showListView() {
  document.getElementById('listView').classList.remove('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.add('hidden');
  currentPostId = null;
  render();
}

function showDetailView(id) {
  currentPostId = id;
  document.getElementById('listView').classList.add('hidden');
  document.getElementById('detailView').classList.remove('hidden');
  document.getElementById('formView').classList.add('hidden');
  renderDetail();
}

function showFormView(editId = null) {
  document.getElementById('listView').classList.add('hidden');
  document.getElementById('detailView').classList.add('hidden');
  document.getElementById('formView').classList.remove('hidden');

  if (editId) {
    const post = posts.find(p => p.id === editId);
    document.getElementById('formTitle').innerText = '게시글 수정';
    document.getElementById('editPostId').value = post.id;
    document.getElementById('postTitleInput').value = post.title;
    document.getElementById('postTagsInput').value = post.tags ? post.tags.join(', ') : '';
    document.getElementById('postQuestionInput').value = post.question;
    document.getElementById('postAnswerInput').value = post.answer;
  } else {
    document.getElementById('formTitle').innerText = '새 글 작성';
    document.getElementById('editPostId').value = '';
    document.getElementById('postTitleInput').value = '';
    document.getElementById('postTagsInput').value = '';
    document.getElementById('rawChatInput').value = '';
    document.getElementById('postQuestionInput').value = '';
    document.getElementById('postAnswerInput').value = '';
  }
  renderRecentTags();   // ← 추가
}

/* 원문 자동 파싱 도우미 */
function parseRawChat() {
  const rawText = document.getElementById('rawChatInput').value.trim();
  if (!rawText) return alert('분할할 대화 원문을 입력해주세요.');

  let qText = '';
  let aText = '';

  if (rawText.includes('AI:') || rawText.includes('User:')) {
    const parts = rawText.split(/AI:/i);
    let userPart = parts[0].replace(/User:/i, '').trim();
    let aiPart = parts[1] ? parts[1].trim() : '';
    qText = userPart;
    aText = aiPart;
  } else if (rawText.includes('질문:') || rawText.includes('답변:')) {
    const parts = rawText.split(/답변:/i);
    qText = parts[0].replace(/질문:/i, '').trim();
    aText = parts[1] ? parts[1].trim() : '';
  } else {
    qText = rawText;
  }

  if (qText) document.getElementById('postQuestionInput').value = qText;
  if (aText) document.getElementById('postAnswerInput').value = aText;
  alert('대화 내용이 질문과 답변 영역으로 분할되었습니다.');
}

/* 이전/다음글 이동 */
function navigateToPost(direction) {
  const currentList = getFilteredAndSortedPosts();
  const currentIndex = currentList.findIndex(p => p.id === currentPostId);
  if (currentIndex === -1) return;

  let targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex >= 0 && targetIndex < currentList.length) {
    showDetailView(currentList[targetIndex].id);
  }
}

/* 마크다운 렌더링 */
function parseContent(text) {
  if (!text) return '';
  try {
    return marked.parse(text, { breaks: true });
  } catch (e) {
    return escapeHTML(text);
  }
}

/* 텍스트 클립보드 복사 */
function copySectionText(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.innerText;
  navigator.clipboard.writeText(text).then(() => {
    alert('내용이 클립보드에 복사되었습니다.');
  }).catch(() => {
    alert('복사에 실패했습니다.');
  });
}

/* 렌더링 메인 */
function render() {
  renderTagButtons();
  renderList();
}

function renderTagButtons() {
  const container = document.getElementById('tagListContainer');
  if (!container) return;

  const allTags = new Set();
  posts.forEach(p => {
    if (p.tags && Array.isArray(p.tags)) {
      p.tags.forEach(t => allTags.add(t));
    }
  });

  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = `tag-chip ${selectedTag === 'ALL' ? 'active' : ''}`;
  allBtn.innerText = '전체';
  allBtn.onclick = () => selectTag('ALL');
  container.appendChild(allBtn);

  allTags.forEach(tag => {
    const chipWrapper = document.createElement('div');
    chipWrapper.className = `tag-chip ${selectedTag === tag ? 'active' : ''}`;
    
    const tagSpan = document.createElement('span');
    tagSpan.innerText = tag;
    tagSpan.onclick = () => selectTag(tag);
    chipWrapper.appendChild(tagSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'tag-delete-btn';
    deleteBtn.title = `'${tag}' 태그 일괄 삭제`;
    deleteBtn.innerHTML = '&times;';
    deleteBtn.onclick = (e) => {
      e.stopPropagation();
      deleteTagGlobally(tag);
    };
    chipWrapper.appendChild(deleteBtn);

    container.appendChild(chipWrapper);
  });
}

function selectTag(tagName) {
  selectedTag = tagName;
  currentPage = 1;
  render();
}

function deleteTagGlobally(tagName) {
  if (confirm(`모든 게시글에서 '${tagName}' 태그를 일괄 삭제하시겠습니까?`)) {
    posts.forEach(p => {
      if (p.tags && Array.isArray(p.tags)) {
        p.tags = p.tags.filter(t => t !== tagName);
      }
    });
    if (selectedTag === tagName) selectedTag = 'ALL';
    saveData();
    render();
  }
}

function selectTagAndShowList(tagName) {
  selectedTag = tagName;
  showListView();
}

function handleSearchKeyUp(event) {
  if (event.key === 'Enter') handleFilterChange();
}

function handleFilterChange() {
  currentPage = 1;
  renderList();
}

function resetSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  const bmFilter = document.getElementById('bookmarkFilter');
  if (bmFilter) bmFilter.checked = false;
  selectedTag = 'ALL';
  currentPage = 1;
  render();
}

/* 목록 및 카드 렌더링 */
function renderList() {
  const filtered = getFilteredAndSortedPosts();
  const selectAllCb = document.getElementById('selectAllCheckbox');
  if (selectAllCb) selectAllCb.checked = false;

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;

  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pagePosts = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const tbody = document.getElementById('postTableBody');
  tbody.innerHTML = '';

  const cardContainer = document.getElementById('postCardContainer');
  cardContainer.innerHTML = '';

  if (pagePosts.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 24px; color: var(--secondary-color);">조건에 부합하는 게시글이 없습니다.</td></tr>';
    cardContainer.innerHTML = '<div style="text-align:center; padding: 24px; color: var(--secondary-color);">조건에 부합하는 게시글이 없습니다.</div>';
  } else {
    pagePosts.forEach(post => {
  const totalChars = getTotalCharCount(post).toLocaleString();
  const dateStr = new Date(post.createdAt).toLocaleDateString('ko-KR');
  const previewText = (post.question || '').slice(0, 80) + '...';

  // ▼ 댓글 수 계산 (댓글 + 답댓글 전체)
  const commentCount = (post.comments || []).length;
  const commentBadge = commentCount > 0
    ? `<span class="comment-count-badge">💬 ${commentCount}</span>`
    : '';

  const tagsHtml = (post.tags && post.tags.length > 0)
    ? post.tags.map(t => `<span class="tag-badge" onclick="event.stopPropagation(); selectTag('${escapeHTML(t)}')">${escapeHTML(t)}</span>`).join('')
    : '';

  const bmIcon = post.isBookmarked ? '★' : '☆';
  const bmClass = post.isBookmarked ? 'bookmarked' : '';

  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td style="text-align:center;">
      <input type="checkbox" class="post-checkbox" value="${post.id}" onchange="updateSelectAllState()">
    </td>
    <td style="text-align:center;">
      <button class="bookmark-btn ${bmClass}" onclick="event.stopPropagation(); toggleBookmark('${post.id}')">${bmIcon}</button>
    </td>
    <td>
      <span class="title-link" onclick="showDetailView('${post.id}')">${escapeHTML(post.title)}</span>
      ${commentBadge}
      <div class="post-preview">${escapeHTML(previewText)}</div>
    </td>
    <td style="text-align:center;">${tagsHtml}</td>
    <td style="text-align:center;">${dateStr}</td>
    <td style="text-align:right;">${totalChars}자</td>
  `;
  tbody.appendChild(tr);

  const card = document.createElement('div');
  card.className = 'post-card-item';
  card.onclick = () => showDetailView(post.id);
  card.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <input type="checkbox" class="post-checkbox" value="${post.id}" onclick="event.stopPropagation()" onchange="updateSelectAllState()">
        <button class="bookmark-btn ${bmClass}" onclick="event.stopPropagation(); toggleBookmark('${post.id}')">${bmIcon}</button>
        <h4 style="font-size: 1rem; color: var(--text-color);">${escapeHTML(post.title)}</h4>
        ${commentBadge}
      </div>
      <span style="font-size: 0.75rem; color: var(--secondary-color);">${dateStr}</span>
    </div>
    <div class="post-preview" style="margin-bottom: 8px;">${escapeHTML(previewText)}</div>
    <div style="display: flex; justify-content: space-between; align-items: center;">
      <div>${tagsHtml}</div>
      <span style="font-size: 0.75rem; color: var(--secondary-color);">${totalChars}자</span>
    </div>
  `;
  cardContainer.appendChild(card);
});
  }

  const paginationEl = document.getElementById('pagination');
  paginationEl.innerHTML = '';
  if (totalPages > 1) {
    for (let i = 1; i <= totalPages; i++) {
      const btn = document.createElement('button');
      btn.className = `btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline'}`;
      btn.innerText = i;
      btn.onclick = () => { currentPage = i; renderList(); };
      paginationEl.appendChild(btn);
    }
  }
}

function toggleBookmark(postId) {
  const post = posts.find(p => p.id === postId);
  if (post) {
    post.isBookmarked = !post.isBookmarked;
    saveData();
    renderList();
    if (currentPostId === postId) {
      renderDetail();
    }
  }
}

function toggleBookmarkCurrentPost() {
  if (currentPostId) {
    toggleBookmark(currentPostId);
  }
}

/* 전체 게시글 선택 / 해제 */
function toggleSelectAll(master) {
  const checkboxes = document.querySelectorAll('.post-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = master.checked;
  });
}

/* 개별 체크박스 조작 시 상단 전체선택 상태 동기화 */
function updateSelectAllState() {
  const master = document.getElementById('selectAllCheckbox');
  const checkboxes = document.querySelectorAll('.post-checkbox');
  if (!master || checkboxes.length === 0) return;

  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  master.checked = allChecked;
}

/* 선택한 게시글들에 태그 일괄 추가 (중복 체크박스 제거 및 정확한 ID 추출) */
function addTagToSelectedPosts() {
  const checkboxes = document.querySelectorAll('.post-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('태그를 추가할 게시글을 먼저 선택해주세요.');
    return;
  }

  const inputEl = document.getElementById('batchTagInput');
  if (!inputEl) return;

  const newTag = inputEl.value.trim().replace(/^#/, '');
  if (!newTag) {
    alert('추가할 태그명을 입력해주세요.');
    return;
  }

  // Set을 사용하여 데스크톱/모바일 뷰 중복 체크박스 ID를 완벽히 필터링
  const targetIds = new Set();
  checkboxes.forEach(cb => {
    const val = cb.value;
    const parsedId = !isNaN(val) && !val.startsWith('post_') ? Number(val) : val;
    targetIds.add(parsedId);
  });

  let modifiedCount = 0;
  posts.forEach(p => {
    if (targetIds.has(p.id)) {
      if (!p.tags) p.tags = [];
      if (!p.tags.includes(newTag)) {
        p.tags.push(newTag);
        modifiedCount++;
      }
    }
  });

  if (modifiedCount > 0) {
	recordRecentTags([newTag]);
    saveData();
    render();
    inputEl.value = '';
    alert(`선택한 게시글 중 ${modifiedCount}개에 '${newTag}' 태그가 추가되었습니다.`);
  } else {
    alert('선택한 게시글에 이미 해당 태그가 모두 존재합니다.');
  }
}

/* 선택한 게시글 다중 삭제 (중복 체크박스 제거 및 정확한 ID 추출) */
function deleteSelectedPosts() {
  const checkboxes = document.querySelectorAll('.post-checkbox:checked');
  if (checkboxes.length === 0) return alert('삭제할 게시글을 선택해주세요.');

  const targetIds = new Set();
  checkboxes.forEach(cb => {
    const val = cb.value;
    const parsedId = !isNaN(val) && !val.startsWith('post_') ? Number(val) : val;
    targetIds.add(parsedId);
  });

  if (confirm(`선택한 ${targetIds.size}개의 게시글을 삭제하시겠습니까?`)) {
    posts = posts.filter(p => !targetIds.has(p.id));
    saveData();
    render();
  }
}

/* 상세 페이지 렌더링 */
function renderDetail() {
  const post = posts.find(p => p.id === currentPostId);
  if (!post) return showListView();

  const currentList = getFilteredAndSortedPosts();
  const currentIndex = currentList.findIndex(p => p.id === currentPostId);

  const prevBtn = document.getElementById('prevPostBtn');
  const nextBtn = document.getElementById('nextPostBtn');
  if (prevBtn) prevBtn.disabled = (currentIndex <= 0);
  if (nextBtn) nextBtn.disabled = (currentIndex < 0 || currentIndex >= currentList.length - 1);

  const totalChars = getTotalCharCount(post).toLocaleString();
  const dateStr = new Date(post.createdAt).toLocaleString('ko-KR');

  const bmBtn = document.getElementById('detailBookmarkBtn');
  if (bmBtn) {
    bmBtn.innerText = post.isBookmarked ? '★' : '☆';
    bmBtn.className = `btn btn-outline btn-sm ${post.isBookmarked ? 'bookmarked-active' : ''}`;
  }

  document.getElementById('detailTitle').innerText = post.title;
  document.getElementById('detailDate').innerText = `작성일: ${dateStr}`;
  document.getElementById('detailCharCount').innerText = `전체 글자수(댓글 포함): ${totalChars}자`;
  
  const tagsHtml = (post.tags && post.tags.length > 0)
    ? post.tags.map(t => `<span class="tag-badge" onclick="selectTagAndShowList('${escapeHTML(t)}')">${escapeHTML(t)}</span>`).join('')
    : '';
  document.getElementById('detailTags').innerHTML = tagsHtml;

  document.getElementById('detailQuestion').innerHTML = parseContent(post.question);
  document.getElementById('detailAnswer').innerHTML = parseContent(post.answer);

  renderComments(post.comments || []);
}

/* 저장 / 수정 / 삭제 */
function savePost() {
  const title = document.getElementById('postTitleInput').value.trim();
  const tagsRaw = document.getElementById('postTagsInput').value.trim();
  const question = document.getElementById('postQuestionInput').value;
  const answer = document.getElementById('postAnswerInput').value;
  const editId = document.getElementById('editPostId').value;

  if (!title) return alert('제목을 입력해주세요.');

  const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0) : [];

  if (editId) {
    const parsedEditId = !isNaN(editId) && !editId.startsWith('post_') ? Number(editId) : editId;
    const post = posts.find(p => p.id === parsedEditId);
    if (post) {
      post.title = title;
      post.tags = tags;
      post.question = question;
      post.answer = answer;
    }
  } else {
    const newPost = {
      id: 'post_' + Date.now(),
      title,
      tags,
      question,
      answer,
      createdAt: new Date().toISOString(),
      isBookmarked: false,
      comments: []
    };
    posts.unshift(newPost);
  }
  
  recordRecentTags(tags);

  saveData();
  if (editId) {
    showDetailView(editId);
  } else {
    showListView();
  }
}

function editCurrentPost() {
  showFormView(currentPostId);
}

function deleteCurrentPost() {
  if (confirm('이 게시글을 삭제하시겠습니까?')) {
    posts = posts.filter(p => p.id !== currentPostId);
    saveData();
    showListView();
  }
}

/* TXT 다운로드 */
function downloadTxt() {
  const post = posts.find(p => p.id === currentPostId);
  if (!post) return;

  const content = `제목: ${post.title}
태그: ${post.tags ? post.tags.join(', ') : ''}
작성일: ${new Date(post.createdAt).toLocaleString('ko-KR')}
========================================

[질문]
${post.question}

========================================

[답변]
${post.answer}
`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${post.title.replace(/[\/\\?%*:|"<>]/g, '_')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

/* JSON 백업/복원 */
function exportJSON() {
  const dataStr = JSON.stringify(posts, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `log_backup_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJSON(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const importedData = JSON.parse(e.target.result);
      if (Array.isArray(importedData)) {
        if (confirm('기존 데이터를 덮어쓰고 복원하시겠습니까? (취소 시 기존 데이터에 추가됩니다)')) {
          posts = importedData;
        } else {
          posts = [...importedData, ...posts];
        }
        saveData();
        render();
        alert('성공적으로 복원되었습니다.');
      } else {
        alert('올바르지 않은 JSON 데이터 형식입니다.');
      }
    } catch (err) {
      alert('JSON 파일을 읽는 중 오류가 발생했습니다.');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

/* 댓글 관리 */
function addComment(parentId = null) {
  const post = posts.find(p => p.id === currentPostId);
  if (!post) return;

  let inputEl = parentId 
    ? document.getElementById(`replyInput_${parentId}`)
    : document.getElementById('newCommentInput');
  
  const text = inputEl.value.trim();
  if (!text) return alert('댓글 내용을 입력해 주세요.');

  if (!post.comments) post.comments = [];

  const newComment = {
    id: 'cmt_' + Date.now(),
    parentId: parentId,
    text: text,
    createdAt: new Date().toISOString()
  };

  post.comments.push(newComment);
  saveData();
  inputEl.value = '';
  renderDetail();
}

function showEditCommentForm(commentId) {
  document.getElementById(`cmtText_${commentId}`).classList.add('hidden');
  document.getElementById(`cmtActions_${commentId}`).classList.add('hidden');
  document.getElementById(`editForm_${commentId}`).classList.remove('hidden');
}

function cancelEditComment(commentId) {
  document.getElementById(`cmtText_${commentId}`).classList.remove('hidden');
  document.getElementById(`cmtActions_${commentId}`).classList.remove('hidden');
  document.getElementById(`editForm_${commentId}`).classList.add('hidden');
}

function saveEditComment(commentId) {
  const post = posts.find(p => p.id === currentPostId);
  if (!post) return;
  const comment = post.comments.find(c => c.id === commentId);
  if (!comment) return;

  const inputEl = document.getElementById(`editInput_${commentId}`);
  const newText = inputEl.value.trim();
  if (!newText) return alert('댓글 내용을 입력해 주세요.');

  comment.text = newText;
  saveData();
  renderDetail();
}

function deleteComment(commentId) {
  const post = posts.find(p => p.id === currentPostId);
  if (!post) return;

  if (confirm('이 댓글을 삭제하시겠습니까?')) {
    const idsToDelete = new Set([commentId]);
    post.comments.forEach(c => {
      if (c.parentId === commentId) idsToDelete.add(c.id);
    });
    post.comments = post.comments.filter(c => !idsToDelete.has(c.id));
    saveData();
    renderDetail();
  }
}

/* 최근 사용 태그 이력 */
function loadRecentTags() {
  try {
    const data = localStorage.getItem(RECENT_TAGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function recordRecentTags(tags) {
  if (!tags || tags.length === 0) return;
  let recent = loadRecentTags();
  // 새로 입력한 태그를 앞으로 이동 (중복 제거, 최신순 유지)
  tags.forEach(tag => {
    recent = recent.filter(t => t !== tag);
    recent.unshift(tag);
  });
  recent = recent.slice(0, RECENT_TAGS_MAX);
  localStorage.setItem(RECENT_TAGS_KEY, JSON.stringify(recent));
}

/* 폼에 최근 사용 태그 추천 칩 렌더링 */
function renderRecentTags() {
  const container = document.getElementById('recentTagsContainer');
  if (!container) return;

  const recent = loadRecentTags();
  container.innerHTML = '';

  if (recent.length === 0) {
    container.innerHTML = '<span class="recent-tags-empty">최근 사용한 태그가 없습니다.</span>';
    return;
  }

  const label = document.createElement('span');
  label.className = 'recent-tags-label';
  label.innerText = '최근 태그:';
  container.appendChild(label);

  recent.forEach(tag => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'recent-tag-chip';
    chip.innerText = `#${tag}`;
    chip.title = `'${tag}' 태그 추가`;
    chip.onclick = () => addTagToInput(tag);
    container.appendChild(chip);
  });
}

/* 추천 태그 클릭 시 태그 입력란에 추가 (중복 방지) */
function addTagToInput(tag) {
  const input = document.getElementById('postTagsInput');
  if (!input) return;

  const current = input.value.split(',').map(t => t.trim()).filter(t => t.length > 0);
  if (current.includes(tag)) {
    // 이미 있으면 알림만
    return;
  }
  current.push(tag);
  input.value = current.join(', ');
  input.focus();
}

function toggleReplyForm(commentId) {
  const formEl = document.getElementById(`replyForm_${commentId}`);
  if (formEl) formEl.classList.toggle('hidden');
}

function renderComments(comments) {
  const container = document.getElementById('commentsList');
  container.innerHTML = '';

  const rootComments = comments.filter(c => !c.parentId);
  const replyCount = comments.filter(c => !!c.parentId).length;

  // 댓글 헤더 (댓글 수 + 답댓글 수)
  const header = document.createElement('div');
  header.className = 'comment-count-header';
  header.innerHTML = `댓글 <strong>${rootComments.length}</strong>개 · 답댓글 <strong>${replyCount}</strong>개`;
  container.appendChild(header);

  if (rootComments.length === 0) {
    const empty = document.createElement('p');
    empty.style.cssText = 'color: var(--secondary-color); font-size:0.9rem; margin-top:12px;';
    empty.innerText = '등록된 댓글이 없습니다.';
    container.appendChild(empty);
    return;
  }

  rootComments.forEach(cmt => {
    container.appendChild(createCommentElement(cmt, comments));
  });
}

function createCommentElement(comment, allComments) {
  const div = document.createElement('div');
  const isReply = !!comment.parentId;
  div.className = `comment-card ${isReply ? 'reply' : ''}`;
  const dateStr = new Date(comment.createdAt).toLocaleString('ko-KR');

  div.innerHTML = `
    <div id="cmtText_${comment.id}" class="comment-text">${parseContent(comment.text)}</div>
    
    <div class="comment-footer">
      <span class="comment-date">${dateStr}</span>
      <div id="cmtActions_${comment.id}" class="comment-actions">
        <button class="btn btn-outline btn-sm" onclick="copySectionText('cmtText_${comment.id}')">복사</button>
        ${!isReply ? `<button class="btn btn-outline btn-sm" onclick="toggleReplyForm('${comment.id}')">답글</button>` : ''}
        <button class="btn btn-outline btn-sm" onclick="showEditCommentForm('${comment.id}')">수정</button>
        <button class="btn btn-danger btn-sm" onclick="deleteComment('${comment.id}')">삭제</button>
      </div>
    </div>

    <div id="editForm_${comment.id}" class="hidden" style="margin-top: 8px;">
      <textarea id="editInput_${comment.id}" rows="15">${escapeHTML(comment.text)}</textarea>
      <div style="margin-top: 6px; display: flex; gap: 6px;">
        <button class="btn btn-primary btn-sm" onclick="saveEditComment('${comment.id}')">저장</button>
        <button class="btn btn-outline btn-sm" onclick="cancelEditComment('${comment.id}')">취소</button>
      </div>
    </div>
    <div id="replyForm_${comment.id}" class="hidden" style="margin-top: 10px;">
      <textarea id="replyInput_${comment.id}" rows="15" placeholder="답댓글을 입력하세요..."></textarea>
      <button class="btn btn-primary btn-sm" style="margin-top: 4px;" onclick="addComment('${comment.id}')">등록</button>
    </div>
  `;

  const replies = allComments.filter(c => c.parentId === comment.id);
  replies.forEach(reply => {
    div.appendChild(createCommentElement(reply, allComments));
  });

  return div;
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

/* 게시글 총 글자수 계산 (본문 + 댓글 + 답댓글) */
function getTotalCharCount(post) {
  const qLen = post.question ? post.question.length : 0;
  const aLen = post.answer ? post.answer.length : 0;
  const commentLen = (post.comments || []).reduce((sum, c) => sum + (c.text ? c.text.length : 0), 0);
  return qLen + aLen + commentLen;
}