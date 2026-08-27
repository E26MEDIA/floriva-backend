(function () {
  const qs = (sel, root = document) => root.querySelector(sel);

  function insertAtCursor(textarea, html) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(html, start, end, 'end');
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  }

  function surround(textarea, before, after) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || 'text';
    textarea.setRangeText(`${before}${selected}${after}`, start, end, 'end');
    textarea.focus();
    textarea.dispatchEvent(new Event('input'));
  }

  function bindPreview(form) {
    const textarea = qs('[name="content"]', form);
    const preview = qs('[data-preview]', form);
    if (!textarea || !preview) return;
    const update = () => {
      preview.innerHTML = textarea.value || '<p class="muted">Write text, then insert an image to see placement.</p>';
    };
    textarea.addEventListener('input', update);
    update();
  }

  function openDialog(textarea) {
    const existing = qs('#media-dialog');
    if (existing) existing.remove();
    const dialog = document.createElement('div');
    dialog.id = 'media-dialog';
    dialog.className = 'modal-backdrop';
    dialog.innerHTML = `
      <form class="modal">
        <h3>Insert image</h3>
        <p class="help">Choose the file and where it sits in the article (left, center, right, or full width).</p>
        <label>Image file <input type="file" name="image" accept="image/*" required></label>
        <label>ALT text <input name="alt" placeholder="Describe the image"></label>
        <label>Caption <input name="caption" placeholder="Optional"></label>
        <fieldset class="placement">
          <legend>Placement</legend>
          <label><input type="radio" name="align" value="left"> Left — text wraps on the right</label>
          <label><input type="radio" name="align" value="center" checked> Center</label>
          <label><input type="radio" name="align" value="right"> Right — text wraps on the left</label>
          <label><input type="radio" name="align" value="full"> Full width</label>
        </fieldset>
        <label>Size
          <select name="size">
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large" selected>Large</option>
            <option value="full">Full</option>
          </select>
        </label>
        <p class="error" data-error hidden></p>
        <div class="actions">
          <button type="submit">Upload and insert</button>
          <button type="button" class="ghost" data-cancel>Cancel</button>
        </div>
      </form>
    `;
    document.body.appendChild(dialog);
    const close = () => dialog.remove();
    qs('[data-cancel]', dialog).addEventListener('click', close);
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) close();
    });
    qs('form', dialog).addEventListener('submit', async (event) => {
      event.preventDefault();
      const err = qs('[data-error]', dialog);
      err.hidden = true;
      const form = event.target;
      const fd = new FormData(form);
      try {
        const res = await fetch('/api/cms/blog/images', {
          method: 'POST',
          body: fd,
          credentials: 'same-origin',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.success === false) {
          throw new Error(data.message || 'Upload failed');
        }
        insertAtCursor(textarea, `\n${data.data.html}\n`);
        close();
      } catch (error) {
        err.hidden = false;
        err.textContent = error.message;
      }
    });
  }

  document.querySelectorAll('form.editor').forEach((form) => {
    bindPreview(form);
    const textarea = qs('[name="content"]', form);
    form.querySelectorAll('[data-h]').forEach((button) => {
      button.addEventListener('click', () => surround(textarea, `<${button.dataset.h}>`, `</${button.dataset.h}>`));
    });
    qs('[data-link]', form)?.addEventListener('click', () => {
      const href = prompt('Internal path or URL', '/');
      if (!href) return;
      surround(textarea, `<a href="${href}">`, '</a>');
    });
    qs('[data-img]', form)?.addEventListener('click', () => openDialog(textarea));
  });
})();
