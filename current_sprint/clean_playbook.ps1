$path = "current_sprint\massivee2e_playbook.md"
$content = Get-Content -Raw $path
$marker = "rather than just a missing DOM string."
$idx = $content.IndexOf($marker)
if ($idx -ne -1) {
    $content = $content.Substring(0, $idx + $marker.Length) + "`r`n"
}
$content = $content -replace "3001", "8080"
[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Output "Cleaned and updated massivee2e_playbook.md"
