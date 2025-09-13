// Temporary file to create the new solution component
const SolutionBox = ({ 
  title, 
  content, 
  onContentChange, 
  isEditing, 
  setIsEditing, 
  editedContent, 
  setEditedContent,
  onDownloadPDF,
  showEmail = false,
  userEmail,
  setUserEmail,
  onEmailSolution,
  isEmailSending
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center">
          <CheckCircle className="w-5 h-5 mr-2 text-emerald-500" />
          {title}
        </h3>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setIsEditing(!isEditing);
              if (!isEditing) {
                setEditedContent(content);
              }
            }}
            variant="ghost"
            size="sm"
            className="text-slate-600 hover:text-slate-900"
            title="Edit solution"
          >
            {isEditing ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
          </Button>
          <Button
            onClick={onDownloadPDF}
            variant="ghost"
            size="sm"
            className="text-slate-600 hover:text-slate-900"
            title="Download as PDF"
          >
            <Download className="w-4 h-4" />
          </Button>
        </div>
      </div>
      
      {isEditing ? (
        <div className="space-y-3">
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            className="min-h-[300px] font-mono text-sm"
            placeholder="Edit the solution..."
          />
          <div className="flex gap-2">
            <Button
              onClick={() => {
                onContentChange(editedContent);
                setIsEditing(false);
              }}
              size="sm"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <Button
              onClick={() => setIsEditing(false)}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <MathRenderer 
          content={content}
          className="space-y-4 math-content"
        />
      )}
      
      {showEmail && (
        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="flex items-center space-x-2">
            <Input
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              placeholder="Enter email address..."
              className="flex-1"
            />
            <Button
              onClick={onEmailSolution}
              disabled={isEmailSending}
              variant="outline"
              size="sm"
            >
              {isEmailSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};