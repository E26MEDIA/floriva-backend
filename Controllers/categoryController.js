const Category = require('../Model/Category');
const { ensureUniqueSlug } = require('../Utils/slug');

// =============================
// Create Category
// =============================
const createCategory = async (req, res) => {
  try {
    const { name } = req.body;
    // FIX: must be "let" so we can reassign after JSON.parse
    let { subCategories } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    if (typeof subCategories === 'string') {
      try { subCategories = JSON.parse(subCategories); } catch { subCategories = []; }
    }

    let categoriesimg = null;
    if (req.file) {
      categoriesimg = req.file.path.replace(/\\/g, '/');
    }

    const category = new Category({
      name: name.trim(),
      subCategories: Array.isArray(subCategories) ? subCategories : [],
      categoriesimg,
      metaTitle: req.body.metaTitle || '',
      metaDescription: req.body.metaDescription || '',
      robotsIndex: req.body.robotsIndex !== 'false' && req.body.robotsIndex !== false,
    });
    category.slug = await ensureUniqueSlug(Category, req.body.slug || category.name, category._id);

    await category.save();
    res.status(201).json({ success: true, message: 'Category created successfully', category });
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ success: false, message: 'Error creating category', error: error.message });
  }
};

// =============================
// Get All Categories
// =============================
const getAllCategories = async (req, res) => {
  try {
    const categories = await Category.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Error fetching categories', error: error.message });
  }
};

// =============================
// Get Single Category
// =============================
const getCategoryById = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, category });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ success: false, message: 'Error fetching category', error: error.message });
  }
};

// =============================
// Update Category
// =============================
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    let { subCategories } = req.body;

    const category = await Category.findById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    if (typeof subCategories === 'string') {
      try { subCategories = JSON.parse(subCategories); } catch { subCategories = category.subCategories; }
    }

    if (name)                         category.name          = name.trim();
    if (Array.isArray(subCategories)) category.subCategories = subCategories;
    if (req.file)                     category.categoriesimg = req.file.path.replace(/\\/g, '/');
    if (req.body.metaTitle !== undefined) category.metaTitle = req.body.metaTitle;
    if (req.body.metaDescription !== undefined) category.metaDescription = req.body.metaDescription;
    if (req.body.robotsIndex !== undefined) {
      category.robotsIndex = req.body.robotsIndex !== 'false' && req.body.robotsIndex !== false;
    }
    if (req.body.slug !== undefined || !category.slug) {
      category.slug = await ensureUniqueSlug(
        Category,
        req.body.slug || category.name,
        category._id
      );
    }

    await category.save();
    res.status(200).json({ success: true, message: 'Category updated successfully', category });
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ success: false, message: 'Error updating category', error: error.message });
  }
};

// =============================
// Delete Category
// =============================
const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ success: false, message: 'Error deleting category', error: error.message });
  }
};

module.exports = { createCategory, updateCategory, getAllCategories, getCategoryById, deleteCategory };